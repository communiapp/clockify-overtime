import { eachDayOfInterval, endOfDay, formatISO, isWeekend, startOfDay, getDay, isAfter } from 'date-fns';
import { isHoliday } from 'feiertagejs';
import { getSummaryReport, SummaryReportResponse, getSummaryReportPDF } from './clockifyApi';

export interface OvertimeResult {
  allocatedSeconds: number;
  businessSeconds: number;
  overtimeSeconds: number;
  missingDates: Date[];
}

export async function requestAndCalculateOvertime(
  apiKey: string,
  userId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  hoursPerDay: number,
  workingDays: number[]
): Promise<OvertimeResult | undefined> {
  const report = await getSummaryReport(apiKey, userId, workspaceId, startOfDay(startDate), endOfDay(endDate));
  console.log(report);
  if (!report.groupOne.length) {
    return;
  }
  return calculateOvertime(report, startDate, endDate, hoursPerDay, workingDays);
}

export function calculateOvertime(report: SummaryReportResponse, startDate: Date, endDate: Date, hoursPerDay: number, workingDays: number[]): OvertimeResult {
  const allocatedSeconds = report.groupOne[0].duration;
  const switchDate: Date = new Date('2022-06-30');
  const dayCount = eachDayOfInterval({ start: startDate, end: endDate }).filter(
    function (date){
      if(isWeekend(date)){
        return false;
      }
      if(isAfter(date, switchDate) && isHoliday(date, 'BY')){
          return false;
      }
      return true;
    }).length;

  const businessSeconds = dayCount * hoursPerDay * 60 * 60;

  const overtimeSeconds = allocatedSeconds - businessSeconds;
  const missingDates = eachDayOfInterval({ start: startDate, end: endDate }).filter(
    (date) =>
      (!isWeekend(date) &&
      !isHoliday(date, 'BY') &&
      !report.groupOne[0].children.some((dayEntry) => dayEntry.name === formatISO(date, { representation: 'date' }))) &&
      workingDays.includes(getDay(date))
  );

  return { allocatedSeconds, businessSeconds, overtimeSeconds, missingDates };
}

export async  function generatePDF(
  apiKey: string,
  userId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const report = await getSummaryReportPDF(apiKey, userId, workspaceId, startOfDay(startDate), endOfDay(endDate));
}
