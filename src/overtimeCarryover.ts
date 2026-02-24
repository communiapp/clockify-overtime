export interface OvertimeCarryover {
  userId: string;
  year: number;
  overtimeHours: number; // positiv = Überstunden, negativ = Fehlstunden
}

export const overtimeCarryover: OvertimeCarryover[] = [
  { userId: '6180ff00f9914c556e304294', year: 2026, overtimeHours: 24.87 },
  { userId: '63fe5f49a094e40fbeea5dc3', year: 2026, overtimeHours: 14.37 },
  { userId: '65a55d44337bb15354ceb3bc', year: 2026, overtimeHours: 5.72 },
  { userId: '67a247e19a004c22985ca0d8', year: 2026, overtimeHours: 5.08 },
  { userId: '67e3b8968411754017f07fe8', year: 2026, overtimeHours: 12.15 }
];
