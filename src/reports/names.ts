import type { Report } from "../domain/types.ts";
import { dateKey } from "../domain/dates.ts";
export function reportFileName(report: Report) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: report.settings.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(report.issuedAt))
    .replace(/[^0-9]/g, "");
  const id = report.id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "report";
  return `nuzul-${dateKey(report.issuedAt, report.settings.timeZone)}-${time}-${id}.pdf`;
}
