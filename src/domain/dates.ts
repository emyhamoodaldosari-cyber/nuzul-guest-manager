import { digits, UserError, validDateOnly } from "./validation.ts";
/** Calendar keys are compared as strings, never by the phone's own time zone. */
export function dateKey(iso: string, timeZone = "Asia/Aden") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function adenDayBounds(iso: string) {
  const start = new Date(`${dateKey(iso)}T00:00:00+03:00`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}
export function isInReportPeriod(
  issuedAt: string,
  period: "all" | "today" | "week",
  now: string,
  timeZone = "Asia/Aden",
) {
  if (period === "all") return true;
  const day = dateKey(issuedAt, timeZone),
    today = dateKey(now, timeZone);
  if (period === "today") return day === today;
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  return day >= cutoff.toISOString().slice(0, 10) && day <= today;
}
export function localInput(iso = new Date().toISOString()) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => p.find((x) => x.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
export function inputToInstant(input: string) {
  const text = digits(input.trim());
  const match = /^(\d{4}-\d\d-\d\d) (\d\d):(\d\d)$/.exec(text);
  if (
    !match ||
    !validDateOnly(match[1]!) ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59
  )
    throw new UserError("وقت الدخول بصيغة YYYY-MM-DD HH:mm بتوقيت اليمن.");
  return new Date(`${match[1]}T${match[2]}:${match[3]}:00+03:00`).toISOString();
}
