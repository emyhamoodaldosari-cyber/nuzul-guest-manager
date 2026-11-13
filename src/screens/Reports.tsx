import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useStore, message } from "../components/store.tsx";
import {
  Badge,
  Button,
  C,
  Card,
  Empty,
  Field,
  Icon,
  Notice,
  Page,
  Section,
  Sheet,
  Txt,
  U,
} from "../components/ui.tsx";
import type { Report, Resident, Settings } from "../domain/types.ts";
import { reportWarnings, digits, validDateOnly } from "../domain/validation.ts";
import { dateKey, isInReportPeriod } from "../domain/dates.ts";
import { dateLabel } from "../reports/template.ts";
import { shareReport, saveReport } from "../reports/export.ts";
type Preview = { entries: Resident[]; settings: Settings; fingerprint: string };
export default function Reports() {
  const { repo, reports, residents, settings, refresh } = useStore();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [archived, setArchived] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [period, setPeriod] = useState<"all" | "today" | "week">("all");
  const [date, setDate] = useState("");
  const [saved, setSaved] = useState(false);
  const dateFilter = digits(date.trim());
  const validFilter = !dateFilter || validDateOnly(dateFilter);
  const filtered = reports.filter(
    (r) =>
      validFilter &&
      isInReportPeriod(
        r.issuedAt,
        period,
        new Date().toISOString(),
        settings.timeZone,
      ) &&
      (!dateFilter || dateKey(r.issuedAt, settings.timeZone) === dateFilter),
  );
  async function prepare() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await repo.reportPreview());
      setReviewed(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function view(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setArchived(await repo.report(id));
      setSaved(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const report = await repo.issueReport(preview.fingerprint);
      setArchived(report);
      setPreview(null);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function confirmIssue() {
    const warnings = preview ? reportWarnings(preview.entries) : [];
    if (warnings.length)
      Alert.alert(
        "بيانات هوية غير مكتملة",
        `هناك ${warnings.length} نزيل ببيانات هوية ناقصة. هل تصدر الكشف مع إظهار الحقول غير المسجلة؟`,
        [
          { text: "عودة للمراجعة", style: "cancel" },
          { text: "إصدار بالبيانات الحالية", onPress: () => void issue() },
        ],
      );
    else void issue();
  }
  async function share() {
    if (!archived || busy) return;
    setBusy(true);
    setError("");
    try {
      await shareReport(archived);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveToPhone() {
    if (!archived || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setSaved(await saveReport(archived));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const entries = preview?.entries ?? archived?.entries ?? [];
  const s = preview?.settings ?? archived?.settings ?? settings;
  return (
    <>
      <Page title="المعلومية اليومية" kicker="راجع. أصدر. شارك.">
        <Card
          style={{ backgroundColor: C.ink, borderColor: C.ink, padding: 22 }}
        >
          <View
            style={[
              U.row,
              { justifyContent: "space-between", marginBottom: 14 },
            ]}
          >
            <Icon name="document-text-outline" color="#D6E4D8" size={30} />
            <Txt style={{ fontSize: 34, color: C.white, fontWeight: "700" }}>
              {residents.length.toLocaleString("ar")}
            </Txt>
          </View>
          <Txt
            style={{
              color: C.white,
              fontWeight: "700",
              fontSize: 18,
              marginBottom: 8,
            }}
          >
            جميع النزلاء الموجودين الآن
          </Txt>
          <Txt
            style={{
              color: "#BCD1C4",
              fontSize: 12,
              lineHeight: 23,
              marginBottom: 20,
            }}
          >
            تُحفظ نسخة ثابتة وقت الإصدار، ثم يمكنك مشاركة ملف PDF بنفسك.
          </Txt>
          <Button
            title="مراجعة كشف جديد"
            icon="eye-outline"
            kind="secondary"
            busy={busy && !archived && !preview}
            disabled={!residents.length || busy}
            onPress={() => void prepare()}
          />
        </Card>
        {error && !preview && !archived ? (
          <Notice danger>{error}</Notice>
        ) : null}
        <Section
          title="أرشيف التقارير"
          subtitle={`${filtered.length} من ${reports.length} كشف محفوظ`}
        />
        <View style={[U.row, { marginBottom: 16 }]}>
          {(
            [
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "آخر ٧ أيام" },
            ] as const
          ).map((p) => (
            <Button
              key={p.id}
              title={p.label}
              small
              kind={period === p.id ? "primary" : "secondary"}
              onPress={() => {
                setPeriod(p.id);
                setDate("");
              }}
            />
          ))}
        </View>
        <Field
          label="البحث بتاريخ محدد"
          placeholder="YYYY-MM-DD"
          value={date}
          maxLength={10}
          onChangeText={(value) => {
            setDate(value);
            setPeriod("all");
          }}
        />
        {!validFilter ? (
          <Notice>أدخل تاريخًا صحيحًا بصيغة YYYY-MM-DD.</Notice>
        ) : null}
        {filtered.length ? (
          filtered.map((r) => (
            <Pressable
              key={r.id}
              disabled={busy}
              onPress={() => void view(r.id)}
            >
              <Card>
                <View style={U.row}>
                  <View style={U.emptyIcon}>
                    <Icon name="document-outline" color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: "700" }}>
                      {dateLabel(r.issuedAt, settings.timeZone)}
                    </Txt>
                    <Txt style={U.caption}>
                      {dateLabel(r.issuedAt, settings.timeZone, true)} •{" "}
                      {r.count} نزيل
                    </Txt>
                  </View>
                  <Icon name="chevron-back" color={C.muted} size={18} />
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <Empty
            title={
              reports.length
                ? "لا توجد تقارير لهذه الفترة"
                : "أول كشف يبدأ من هنا"
            }
            body={
              reports.length
                ? "غيّر الفترة أو امسح التاريخ لعرض جميع الكشوف."
                : "بعد تسجيل النزلاء، راجع الكشف وأصدره. ستجد نسخه السابقة في هذا الأرشيف."
            }
          />
        )}
      </Page>
      <Sheet
        visible={!!preview || !!archived}
        title={preview ? "مراجعة الكشف قبل الإصدار" : "كشف مؤرشف"}
        busy={busy}
        onClose={() => {
          setPreview(null);
          setArchived(null);
          setError("");
          setSaved(false);
        }}
      >
        <Section title={s.propertyName} subtitle={s.address} />
        <Badge
          text={preview ? "معاينة حية • لم يصدر بعد" : "نسخة ثابتة محفوظة"}
          tone={preview ? "gold" : "green"}
        />
        {archived ? (
          <Txt style={[U.caption, { marginTop: 12 }]}>
            وقت الإصدار: {dateLabel(archived.issuedAt, s.timeZone, true)}
          </Txt>
        ) : null}
        <View style={U.divider} />
        <Section
          title={`${entries.length} نزيل في الكشف`}
          subtitle="كل نزيل في صف مستقل. يعرض PDF جميع حقول الهوية."
        />
        {entries.map((g, i) => (
          <Card key={g.stayId}>
            <View style={[U.row, { justifyContent: "space-between" }]}>
              <Txt style={{ fontWeight: "700", flex: 1 }}>
                {i + 1}. {g.fullName}
              </Txt>
              <Badge text={g.roomLabel} />
            </View>
            <Txt style={U.caption}>
              {g.nationality} • {g.governorate} / {g.city}
            </Txt>
            <Txt style={U.caption}>
              {g.identityType}: {g.identityNumber || "غير مسجل"}
            </Txt>
            <Txt style={U.caption}>
              جهة الإصدار: {g.identityIssuer || "غير مسجلة"} •{" "}
              {g.identityIssuedOn || "التاريخ غير مسجل"}
            </Txt>
            <Txt style={U.caption}>
              الدخول: {dateLabel(g.checkIn, s.timeZone, true)}
            </Txt>
            {g.notes ? <Txt style={U.caption}>ملاحظات: {g.notes}</Txt> : null}
          </Card>
        ))}
        {preview && reportWarnings(entries).length ? (
          <Notice>
            توجد بيانات هوية ناقصة لدى {reportWarnings(entries).length} نزيل.
            راجعها في سجل النزلاء أو أصدر الكشف مع توضيح النقص.
          </Notice>
        ) : null}
        <Card>
          <Txt style={{ fontWeight: "700" }}>{s.recipient}</Txt>
          <Txt style={[U.caption, { marginTop: 10 }]}>
            {s.letter.replaceAll(
              "{date}",
              preview
                ? "تاريخ الإصدار"
                : dateLabel(archived!.issuedAt, s.timeZone),
            )}
          </Txt>
        </Card>
        {error ? <Notice danger>{error}</Notice> : null}
        {saved ? <Notice>حُفظ ملف PDF في المجلد الذي اخترته.</Notice> : null}
        {preview ? (
          <>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: reviewed }}
              onPress={() => setReviewed(!reviewed)}
              style={[U.row, { marginBottom: 20, padding: 10 }]}
            >
              <Icon
                name={reviewed ? "checkbox" : "square-outline"}
                color={C.green}
              />
              <Txt style={{ flex: 1, fontSize: 12, lineHeight: 22 }}>
                راجعت بيانات جميع النزلاء، وهي تعكس الموجودين في الاستراحة.
              </Txt>
            </Pressable>
            <Button
              title="إصدار وحفظ الكشف"
              icon="checkmark-circle-outline"
              disabled={!reviewed || !entries.length}
              busy={busy}
              onPress={confirmIssue}
            />
            <Button
              title="تحديث المعاينة"
              kind="ghost"
              onPress={() => void prepare()}
            />
          </>
        ) : (
          <>
            <Button
              title="إنشاء PDF ومشاركته"
              icon="share-outline"
              busy={busy}
              onPress={() => void share()}
            />
            <View style={{ marginTop: 12 }}>
              <Button
                title="حفظ PDF على الهاتف"
                icon="download-outline"
                kind="secondary"
                busy={busy}
                onPress={() => void saveToPhone()}
              />
            </View>
            <Txt style={[U.caption, { textAlign: "center", marginTop: 12 }]}>
              اختر وسيلة الإرسال من نافذة مشاركة أندرويد.
            </Txt>
          </>
        )}
      </Sheet>
    </>
  );
}
