export interface GuestInput {
  fullName: string;
  nationality: string;
  governorate: string;
  city: string;
  identityType: string;
  identityNumber: string;
  identityIssuer: string;
  identityIssuedOn: string;
}
export interface Guest extends GuestInput {
  id: string;
  createdAt: string;
}
export interface Room {
  id: string;
  label: string;
  capacity: number;
  occupied: number;
  historyCount: number;
}
export interface RoomAssignment {
  id: string;
  stayId: string;
  roomLabel: string;
  startedAt: string;
  endedAt: string | null;
}
export interface DailyActivity {
  arrivals: number;
  departures: number;
}
export interface StayInput {
  guestId: string;
  roomId: string;
  checkIn: string;
  notes: string;
}
export interface Resident extends Guest {
  stayId: string;
  roomId: string;
  roomLabel: string;
  checkIn: string;
  notes: string;
}
export interface StayHistory {
  id: string;
  roomLabel: string;
  checkIn: string;
  checkOut: string | null;
  notes: string;
}
export interface Settings {
  propertyName: string;
  address: string;
  authority: string;
  recipient: string;
  manager: string;
  managerPhone: string;
  preparer: string;
  preparerPhone: string;
  letter: string;
  timeZone: string;
}
export interface Report {
  id: string;
  issuedAt: string;
  settings: Settings;
  entries: Resident[];
  version: 1;
}
export interface ReportSummary {
  id: string;
  issuedAt: string;
  count: number;
}
export type SqlValue = string | number | null;
/** One shared connection and one queue preserve encryption and foreign-key settings. */
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
}
