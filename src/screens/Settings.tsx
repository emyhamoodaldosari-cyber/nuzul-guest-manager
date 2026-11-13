import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useStore, message } from "../components/store.tsx";
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Notice,
  Page,
  Section,
  Sheet,
  Txt,
  U,
  C,
} from "../components/ui.tsx";
import type { Settings as PropertySettings } from "../domain/types.ts";
import { shareBackup, restoreBackup } from "../security/backup-native.ts";
export default function Settings() {
  const { settings, repo, refresh } = useStore();
  const [form, setForm] = useState<PropertySettings>(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [backup, setBackup] = useState<"export" | "restore" | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await repo.saveSettings(form);
      await refresh();
      setSuccess("حُفظت الإعدادات. ستُستخدم في الكشوف الجديدة.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function backupAction() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (backup === "export") {
        if (password !== confirm)
          throw new Error("كلمتا المرور غير متطابقتين.");
        await shareBackup(repo, password);
      } else if (await restoreBackup(repo, password)) {
        await refresh();
        setForm(await repo.settings());
        Alert.alert(
          "اكتملت الاستعادة",
          "استُعيدت السجلات والتقارير والإعدادات بنجاح.",
        );
      }
      setPassword("");
      setConfirm("");
      setBackup(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function open(mode: "export" | "restore") {
    setError("");
    setPassword("");
    setConfirm("");
    setBackup(mode);
  }
  const fields: {
    key: keyof PropertySettings;
    label: string;
    required?: boolean;
    multiline?: boolean;
  }[] = [
    { key: "propertyName", label: "اسم الاستراحة", required: true },
    { key: "address", label: "العنوان", required: true },
    { key: "authority", label: "الترويسة الرسمية" },
    { key: "recipient", label: "الجهة المستلمة", required: true },
    { key: "manager", label: "اسم المدير" },
    { key: "managerPhone", label: "هاتف المدير" },
    { key: "preparer", label: "اسم معد البيانات" },
    { key: "preparerPhone", label: "هاتف معد البيانات" },
    {
      key: "letter",
      label: "نص الخطاب الختامي",
      required: true,
      multiline: true,
    },
  ];
  return (
    <>
      <Page title="إعدادات الاستراحة" kicker="تفاصيل منشأتك في كل كشف">
        <Section
          title="بيانات التقرير"
          subtitle="القيم الأولية مأخوذة من نموذجك؛ راجعها قبل أول إصدار."
        />
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            multiline={f.multiline}
            value={form[f.key]}
            maxLength={f.multiline ? 2000 : 200}
            hint={
              f.key === "letter"
                ? "اكتب {date} في الموضع الذي تريد إضافة تاريخ التقرير فيه."
                : undefined
            }
            onChangeText={(v) => setForm({ ...form, [f.key]: v })}
          />
        ))}
        <Badge text="توقيت اليمن • Asia/Aden" />
        {success ? (
          <View style={{ marginTop: 15 }}>
            <Notice>{success}</Notice>
          </View>
        ) : null}
        {error && !backup ? <Notice danger>{error}</Notice> : null}
        <View style={{ marginTop: 20 }}>
          <Button
            title="حفظ الإعدادات"
            icon="checkmark"
            busy={busy && !backup}
            onPress={() => void save()}
          />
        </View>
        <View style={U.divider} />
        <Section title="الأمان والنسخ الاحتياطي" />
        <Card>
          <View style={[U.row, { marginBottom: 12 }]}>
            <Icon name="shield-checkmark-outline" color={C.green} />
            <Txt style={{ fontWeight: "700" }}>حماية على الجهاز</Txt>
          </View>
          <Txt style={U.caption}>
            قاعدة بيانات مشفرة، وقفل ببصمة الهاتف أو رمز قفله، وحجب محتوى
            التطبيق عند الانتقال للخلفية.
          </Txt>
        </Card>
        <Card>
          <Txt style={{ fontWeight: "700", marginBottom: 8 }}>
            احتفظ بنسخة قبل تغيير هاتفك
          </Txt>
          <Txt style={[U.caption, { marginBottom: 17 }]}>
            تُشفر النسخة بكلمة مرور تختارها. احتفظ بها؛ لا يمكن استعادتها عند
            فقدانها.
          </Txt>
          <View style={{ gap: 10 }}>
            <Button
              title="تصدير نسخة مشفرة"
              kind="secondary"
              icon="download-outline"
              onPress={() => open("export")}
            />
            <Button
              title="استعادة نسخة"
              kind="ghost"
              icon="cloud-upload-outline"
              onPress={() => open("restore")}
            />
          </View>
        </Card>
        <Txt style={[U.caption, { textAlign: "center", marginTop: 10 }]}>
          نُزل • الإصدار 0.2.0
        </Txt>
      </Page>
      <Sheet
        visible={!!backup}
        title={
          backup === "export" ? "نسخة احتياطية مشفرة" : "استعادة نسخة احتياطية"
        }
        busy={busy}
        onClose={() => {
          setBackup(null);
          setPassword("");
          setConfirm("");
          setError("");
        }}
      >
        <Notice>
          {backup === "export"
            ? "اختر كلمة مرور قوية واحتفظ بها منفصلة عن الملف. تحفظ النسخة النزلاء والإقامات والغرف والتقارير والإعدادات."
            : "الاستعادة متاحة على تثبيت فارغ، قبل إضافة الغرف والنزلاء، لحماية السجلات الحالية من الاستبدال."}
        </Notice>
        <Field
          label="كلمة مرور النسخة"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          maxLength={200}
          hint="١٢ حرفًا على الأقل"
        />
        {backup === "export" ? (
          <Field
            label="تأكيد كلمة المرور"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            maxLength={200}
          />
        ) : null}
        {error ? <Notice danger>{error}</Notice> : null}
        <Button
          title={
            backup === "export" ? "تشفير وحفظ النسخة" : "اختيار الملف واستعادته"
          }
          busy={busy}
          disabled={password.length < 12}
          icon={
            backup === "export" ? "lock-closed-outline" : "folder-open-outline"
          }
          onPress={() => void backupAction()}
        />
        {busy ? (
          <Txt style={[U.caption, { textAlign: "center", marginTop: 15 }]}>
            جارٍ معالجة النسخة، قد يستغرق ذلك عدة ثوانٍ…
          </Txt>
        ) : null}
      </Sheet>
    </>
  );
}
