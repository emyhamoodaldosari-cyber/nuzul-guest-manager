import type { Report, Resident } from "../domain/types.ts";
export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function dateLabel(iso: string, timeZone = "Asia/Aden", time = false) {
  return new Intl.DateTimeFormat("ar-YE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}
/** Conservative row sizing keeps long Arabic fields readable without dropping notes. */
export function reportHtml(report: Report) {
  const { settings: s, entries } = report;
  const e = escapeHtml;
  const rowWeight = (g: Resident) =>
    12 +
    14 *
      Math.max(
        2,
        Math.ceil(g.fullName.length / 24),
        Math.ceil(g.nationality.length / 8),
        Math.ceil(g.governorate.length / 9),
        Math.ceil(g.city.length / 9),
        Math.ceil(g.identityType.length / 9),
        Math.ceil(g.identityIssuer.length / 9),
        Math.ceil(g.roomLabel.length / 8),
        g.notes.length > 180 ? 2 : Math.ceil(g.notes.length / 18),
      ) +
    (g.notes.length > 180 ? 12 + 14 * Math.ceil(g.notes.length / 100) : 0);
  const pages: Resident[][] = [];
  let group: Resident[] = [];
  let used = 0;
  for (const g of entries) {
    const weight = rowWeight(g);
    if (group.length && (used + weight > 320 || group.length >= 11)) {
      pages.push(group);
      group = [];
      used = 0;
    }
    group.push(g);
    used += weight;
  }
  if (group.length || !pages.length) pages.push(group);
  const date = new Intl.DateTimeFormat("ar-YE", {
    timeZone: s.timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(report.issuedAt));
  const letter = s.letter.replaceAll("{date}", date);
  if (used + 100 + Math.ceil(letter.length / 110) * 19 > 430) pages.push([]);
  let cursor = 0;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>معلومية النزلاء</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#142d2b;margin:0;font-size:10px}
  .sheet{page-break-after:always}.sheet:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #24685c;padding-bottom:12px;margin-bottom:12px;gap:20px}
  h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:0 0 5px}p{margin:4px 0;line-height:1.7}.brand{max-width:30%;font-size:11px}.title{text-align:center;flex:1}.authority{max-width:20%;text-align:left}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th,td{border:1px solid #829c94;padding:6px 3px;text-align:center;vertical-align:middle;overflow-wrap:anywhere;line-height:1.5}thead{display:table-header-group}th{background:#e8f0eb;color:#123e34;font-weight:bold}tbody tr:nth-child(even){background:#f7f9f7}tr{page-break-inside:avoid}.ltr{direction:ltr;unicode-bidi:embed}
  .letter{margin-top:15px;border-right:3px solid #24685c;padding:4px 12px;white-space:pre-line;font-size:11px}.signatures{display:flex;justify-content:space-between;margin-top:15px;font-size:10px}.footer{display:flex;justify-content:space-between;border-top:1px solid #c8d7d1;margin-top:14px;padding-top:7px;font-size:9px;color:#4c665d}.muted{color:#57746a}
  </style></head><body>${pages
    .map(
      (
        rows,
        page,
      ) => `<section class="sheet"><header><div class="brand"><h2>${e(s.propertyName)}</h2><p>${e(s.address)}</p></div><div class="title"><h1>معلومية النزلاء ليومنا</h1><p>${e(date)}</p><p class="muted">جميع المقيمين وقت الإصدار • عدد النزلاء: ${entries.length}</p></div><div class="authority">${e(s.authority)}</div></header>
  ${
    rows.length
      ? `<table><colgroup><col style="width:3%"><col style="width:6%"><col style="width:16%"><col style="width:5%"><col style="width:8%"><col style="width:5%"><col style="width:3%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:10%"><col style="width:6%"><col style="width:8%"><col style="width:12%"></colgroup>
  <thead><tr><th rowspan="2">م</th><th rowspan="2">رقم الغرفة</th><th rowspan="2">اسم النزيل رباعيًا</th><th rowspan="2">الجنسية</th><th rowspan="2">تاريخ القدوم</th><th rowspan="2">وقت الدخول</th><th rowspan="2">عدد الأفراد</th><th colspan="6">معلومات الهوية</th><th rowspan="2">ملاحظات</th></tr><tr><th>المحافظة</th><th>المدينة</th><th>نوع الهوية</th><th>رقم الهوية</th><th>جهة الإصدار</th><th>تاريخ الإصدار</th></tr></thead>
  <tbody>${rows.map((g, i) => `<tr><td>${++cursor}</td><td>${e(g.roomLabel)}</td><td>${e(g.fullName)}</td><td>${e(g.nationality)}</td><td>${e(dateLabel(g.checkIn, s.timeZone))}</td><td>${e(new Intl.DateTimeFormat("ar-YE", { timeZone: s.timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(g.checkIn)))}</td><td>1</td><td>${e(g.governorate)}</td><td>${e(g.city)}</td><td>${e(g.identityType)}</td><td class="ltr">${e(g.identityNumber || "غير مسجل")}</td><td>${e(g.identityIssuer || "—")}</td><td class="ltr">${e(g.identityIssuedOn || "—")}</td><td>${e(g.notes.length > 180 ? "التفاصيل أدناه" : g.notes || "—")}</td></tr>${g.notes.length > 180 ? `<tr><td colspan="14" style="text-align:right"><b>ملاحظات ${e(g.fullName)}:</b> ${e(g.notes)}</td></tr>` : ""}`).join("")}</tbody></table>`
      : ""
  }
  ${page === pages.length - 1 ? `<div class="letter"><b>${e(s.recipient)}</b><p>${e(letter)}</p></div><div class="signatures"><div>مدير الاستراحة / ${e(s.manager || "________________")}<p>رقم الهاتف: <span class="ltr">${e(s.managerPhone || "________________")}</span></p></div><div>معد البيانات / ${e(s.preparer || "________________")}<p>رقم الهاتف: <span class="ltr">${e(s.preparerPhone || "________________")}</span></p></div></div>` : ""}
  <div class="footer"><span>وقت الإصدار: ${e(dateLabel(report.issuedAt, s.timeZone, true))}</span><span>صفحة ${page + 1} من ${pages.length} • ${e(report.id.slice(0, 8))}</span></div></section>`,
    )
    .join("")}</body></html>`;
}
