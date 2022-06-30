import axios from 'axios';

const BASE_URL = 'https://api.clockify.me/api/v1';
const REPORT_BASE_URL = 'https://reports.api.clockify.me/v1';

const clockify = axios.create({ baseURL: BASE_URL, validateStatus: (status) => status < 400 });
const report = axios.create({ baseURL: REPORT_BASE_URL, validateStatus: (status) => status < 400 });
const reportPDF = axios.create({ baseURL: REPORT_BASE_URL, validateStatus: (status) => status < 400, responseType: 'blob' });

export interface CurrentUserResponse {
  id: string;
  activeWorkspace: string;
  defaultWorkspace: string;
  email: string;
  name: string;
  profilePicture: string;
}

export async function getCurrentUser(apiKey: string): Promise<CurrentUserResponse> {
  const response = await clockify.get<CurrentUserResponse>('/user', { baseURL: BASE_URL, headers: { 'X-Api-Key': apiKey } });
  return response.data;
}

export interface AllUsersResponse {
  id: string;
  email: string;
  name: string;
  profilePicture: string;
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'INACTIVE';
  roles: { role: string }[];
}

export async function getAllUsers(apiKey: string, workspaceId: string): Promise<AllUsersResponse[]> {
  const response = await clockify.get<AllUsersResponse[]>(
    `/workspaces/${workspaceId}/users?status=ACTIVE&memberships=NONE&includeRoles=true`,
    {
      baseURL: BASE_URL,
      headers: { 'X-Api-Key': apiKey }
    }
  );
  return response.data;
}

export interface ClockifyWorkspace {
  id: string;
  name: string;
}

export type WorkspacesResponse = ReadonlyArray<ClockifyWorkspace>;

export async function getWorkspaces(apiKey: string): Promise<WorkspacesResponse> {
  const response = await clockify.get<WorkspacesResponse>('/workspaces', { baseURL: BASE_URL, headers: { 'X-Api-Key': apiKey } });
  return response.data;
}

export interface SummaryReportResponse {
  totals: [
    {
      totalTime: number;
      totalBillableTime: number;
      entriesCount: number;
      totalAmount: number;
    }
  ];
  groupOne: [
    {
      duration: number;
      amount: number;
      name: string;
      children: [{ name: string; duration: number }];
    }
  ];
}

export async function getSummaryReport(
  apiKey: string,
  userId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<SummaryReportResponse> {
  const response = await report.post<SummaryReportResponse>(
    `/workspaces/${workspaceId}/reports/summary`,
    {
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString(),
      summaryFilter: {
        groups: ['USER', 'DATE']
      },
      users: {
        ids: [userId],
        contains: 'CONTAINS',
        status: 'ALL'
      },
      amountShown: 'HIDE_AMOUNT'
    },
    {
      baseURL: REPORT_BASE_URL,
      headers: { 'X-Api-Key': apiKey }
    }
  );
  return response.data;
}
export async function getSummaryReportPDF(
  apiKey: string,
  userId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<SummaryReportResponse> {

  const users = await getAllUsers(apiKey, workspaceId);
  const currentUser = users.filter(user => user.id === userId)[0];

  const response = await reportPDF.post<SummaryReportResponse>(
    `/workspaces/${workspaceId}/reports/summary`,
    {
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString(),
      exportType: "PDF",
      summaryFilter: {
        groups: ['USER', 'DATE']
      },
      userLocale: "de_DE",
      users: {
        ids: [userId],
        contains: 'CONTAINS',
        status: 'ALL'
      },
      amountShown: 'HIDE_AMOUNT',
      zoomLevel: "MONTH"
    },
    {
      baseURL: REPORT_BASE_URL,
      headers: { 'X-Api-Key': apiKey }
    }
  );
  const blobData: unknown = response.data ;
  const blob = new Blob([blobData as Blob], { type: 'application/pdf' });

  const URL = window.URL || window.webkitURL;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const name = currentUser.name + "_" + startDate.toISOString().split('T')[0] + "_" +  endDate.toISOString().split('T')[0]+".pdf";
  link.target   = '_blank';
  link.href = url;
  link.setAttribute(    //if you just want to preview pdf and dont want download delete this three lines
     'download',
     name,
   );

  // Append to html link element page
  document.body.appendChild(link);

  // Start download
  link.click();

  // Clean up and remove the link
  if(link && link.parentNode){
    link.parentNode.removeChild(link);
  }
  URL.revokeObjectURL(url);

  return response.data;
}
