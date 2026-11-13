import type { GuestInput, Settings } from "./types.ts";
export class UserError extends Error {}
export const digits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
export const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
export function validDateOnly(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function validInstant(s: string) {
  return (
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString() === s
  );
}
export function validateGuest(input: GuestInput): GuestInput {
  const keys: (keyof GuestInput)[] = [
    "fullName",
    "nationality",
    "governorate",
    "city",
    "identityType",
    "identityNumber",
    "identityIssuer",
    "identityIssuedOn",
  ];
  const g = Object.fromEntries(
    keys.map((k) => [k, clean(input[k])]),
  ) as unknown as GuestInput;
  if (Object.values(g).some((v) => v.length > 200))
    throw new UserError("أحد الحقول يتجاوز ٢٠٠ حرف.");
  if (g.fullName.split(/\s+/).length < 4)
    throw new UserError("أدخل اسم النزيل الرباعي.");
  for (const key of [
    "nationality",
    "governorate",
    "city",
    "identityType",
  ] as const)
    if (!g[key])
      throw new UserError("أكمل الجنسية والمحافظة والمدينة ونوع الهوية.");
  g.identityNumber = digits(g.identityNumber).replace(/\s/g, "").toUpperCase();
  if (g.identityNumber && !/^[A-Z0-9\-/]{3,40}$/.test(g.identityNumber))
    throw new UserError("رقم الهوية يجب أن يكون من ٣ إلى ٤٠ حرفًا أو رقمًا.");
  g.identityIssuedOn = digits(g.identityIssuedOn);
  if (g.identityIssuedOn && !validDateOnly(g.identityIssuedOn))
    throw new UserError("تاريخ الإصدار بصيغة YYYY-MM-DD ويجب أن يكون صحيحًا.");
  if (
    g.identityIssuedOn &&
    g.identityIssuedOn >
      new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
    throw new UserError("تاريخ إصدار الهوية لا يمكن أن يكون في المستقبل.");
  return g;
}
export function validateSettings(s: Settings): Settings {
  const result = Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, clean(v)]),
  ) as unknown as Settings;
  if (
    !result.propertyName ||
    !result.address ||
    !result.recipient ||
    !result.letter
  )
    throw new UserError(
      "أكمل اسم الاستراحة والعنوان والجهة المستلمة ونص الخطاب.",
    );
  if (Object.values(result).some((v) => v.length > 2000))
    throw new UserError("النص طويل جدًا.");
  if (Object.entries(result).some(([k, v]) => k !== "letter" && v.length > 200))
    throw new UserError("اختصر بيانات الترويسة إلى ٢٠٠ حرف لكل حقل.");
  try {
    new Intl.DateTimeFormat("ar", { timeZone: result.timeZone }).format();
  } catch {
    throw new UserError("المنطقة الزمنية غير صحيحة.");
  }
  return result;
}
export function reportWarnings(
  entries: {
    fullName: string;
    identityNumber: string;
    identityIssuer: string;
    identityIssuedOn: string;
  }[],
) {
  return entries
    .filter(
      (e) => !e.identityNumber || !e.identityIssuer || !e.identityIssuedOn,
    )
    .map((e) => `بيانات هوية غير مكتملة: ${e.fullName}`);
}
export const DEFAULT_SETTINGS: Settings = {
  propertyName: "استراحة ولوكندة المحمدي",
  address: "جولة وادي القاضي مقابل ألمنيوم الأندلس",
  authority: "وزارة السياحة",
  recipient: "الأخ / مدير البحث الجنائي المحترم",
  manager: "",
  managerPhone: "",
  preparer: "",
  preparerPhone: "",
  timeZone: "Asia/Aden",
  letter:
    "نرفع إليكم معلومية جميع النزلاء الموجودين لدينا وقت إعداد هذا الكشف ليوم {date}. وتفضلوا بقبول فائق الاحترام.",
};
