/** Synthetic data only. No records from the supplied Word document are imported. */
import { writeFileSync } from "node:fs";
import { reportHtml } from "../src/reports/template.ts";
import { DEFAULT_SETTINGS } from "../src/domain/validation.ts";
import type { Report } from "../src/domain/types.ts";
const report: Report = {
  version: 1,
  id: "SAMPLE-REPORT-0001",
  issuedAt: "2026-11-12T15:00:00.000Z",
  settings: {
    ...DEFAULT_SETTINGS,
    propertyName: "استراحة تجريبية — نموذج غير رسمي",
    address: "عنوان تجريبي لمراجعة تنسيق الكشف",
    manager: "مدير تجريبي",
    preparer: "معد بيانات تجريبي",
  },
  entries: Array.from({ length: 26 }, (_, i) => ({
    id: `guest-${i + 1}`,
    stayId: `stay-${i + 1}`,
    roomId: `room-${i + 1}`,
    roomLabel: String(101 + Math.floor(i / 2)),
    fullName: `نزيل تجريبي محمد ${i + 1}`,
    nationality: "يمني",
    governorate: "تعز",
    city: "مدينة تجريبية",
    identityType: "شخصية",
    identityNumber: `0000000${String(i + 1).padStart(3, "0")}`,
    identityIssuer: "جهة تجريبية",
    identityIssuedOn: "2024-02-29",
    createdAt: "2026-11-01T09:00:00.000Z",
    checkIn: "2026-11-10T12:00:00.000Z",
    notes: "بيانات توضيحية فقط",
  })),
};
writeFileSync("docs/sample-report.html", reportHtml(report));
