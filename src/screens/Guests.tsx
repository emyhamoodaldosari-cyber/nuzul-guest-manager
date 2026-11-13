import React, { useEffect, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useStore, message } from "../components/store.tsx";
import {
  Badge,
  Button,
  C,
  Card,
  Choice,
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
import type {
  Guest,
  GuestInput,
  StayHistory,
  RoomAssignment,
} from "../domain/types.ts";
import { matchesSearch } from "../domain/search.ts";
import { inputToInstant, localInput } from "../domain/dates.ts";
import { dateLabel } from "../reports/template.ts";
const empty: GuestInput = {
  fullName: "",
  nationality: "يمني",
  governorate: "",
  city: "",
  identityType: "شخصية",
  identityNumber: "",
  identityIssuer: "",
  identityIssuedOn: "",
};
const labels: {
  key: keyof GuestInput;
  label: string;
  required?: boolean;
  placeholder?: string;
}[] = [
  { key: "fullName", label: "اسم النزيل رباعيًا", required: true },
  { key: "nationality", label: "الجنسية", required: true },
  { key: "governorate", label: "المحافظة", required: true },
  { key: "city", label: "المدينة / المديرية", required: true },
  {
    key: "identityNumber",
    label: "رقم الهوية",
    placeholder: "يُحفظ مع الأصفار في البداية",
  },
  { key: "identityIssuer", label: "جهة الإصدار" },
  {
    key: "identityIssuedOn",
    label: "تاريخ الإصدار",
    placeholder: "YYYY-MM-DD",
  },
];
export function GuestForm({
  guest,
  onClose,
}: {
  guest?: Guest;
  onClose: () => void;
}) {
  const { repo, refresh, rooms } = useStore();
  const [form, setForm] = useState<GuestInput>(guest ?? empty);
  const [roomId, setRoom] = useState("");
  const [date, setDate] = useState(localInput());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (guest) await repo.updateGuest(guest.id, form);
      else
        await repo.register(form, {
          roomId,
          checkIn: inputToInstant(date),
          notes,
        });
      await refresh();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible
      title={guest ? "تعديل بيانات النزيل" : "تسجيل نزيل جديد"}
      busy={busy}
      onClose={onClose}
    >
      <Section
        title="البيانات الشخصية"
        subtitle="يُسجّل كل شخص على حدة، حتى عند مشاركة الغرفة."
      />
      {labels.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          required={f.required}
          value={form[f.key]}
          placeholder={f.placeholder}
          autoCapitalize={f.key === "identityNumber" ? "characters" : "none"}
          maxLength={200}
          onChangeText={(v) => setForm({ ...form, [f.key]: v })}
        />
      ))}
      <Txt style={[U.label, { marginBottom: 10 }]}>نوع الهوية *</Txt>
      <View style={[U.row, { flexWrap: "wrap", marginBottom: 20 }]}>
        {["شخصية", "جواز", "تعريفية", "استبيان", "رقم جلوس", "أخرى"].map(
          (t) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: form.identityType === t }}
              key={t}
              onPress={() => setForm({ ...form, identityType: t })}
              style={{
                padding: 11,
                borderRadius: 10,
                backgroundColor: form.identityType === t ? C.green : C.white,
                borderWidth: 1,
                borderColor: C.line,
              }}
            >
              <Txt
                style={{
                  color: form.identityType === t ? C.white : C.ink,
                  fontSize: 12,
                }}
              >
                {t}
              </Txt>
            </Pressable>
          ),
        )}
      </View>
      {!guest ? (
        <>
          <View style={U.divider} />
          <Section title="بيانات الإقامة" />
          <Field
            label="تاريخ ووقت الدخول *"
            value={date}
            onChangeText={setDate}
            placeholder="2026-11-12 18:30"
            hint="بتوقيت اليمن • YYYY-MM-DD HH:mm"
          />
          <Txt style={[U.label, { marginBottom: 10 }]}>اختر الغرفة *</Txt>
          {rooms
            .filter((r) => r.occupied < r.capacity)
            .map((r) => (
              <Choice
                key={r.id}
                title={`غرفة ${r.label}`}
                subtitle={`${r.occupied} من ${r.capacity} مقيم`}
                selected={roomId === r.id}
                onPress={() => setRoom(r.id)}
              />
            ))}
          {!rooms.some((r) => r.occupied < r.capacity) ? (
            <Notice>
              لا توجد غرفة متاحة. أضف غرفة أو عدّل السعة من صفحة الغرف.
            </Notice>
          ) : null}
          <Field
            label="ملاحظات الإقامة"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
          />
        </>
      ) : null}
      <Notice>
        يمكن حفظ السجل إذا كانت بعض بيانات الهوية غير متاحة. سيظهر تنبيه
        لمراجعتها قبل إصدار التقرير.
      </Notice>
      {error ? <Notice danger>{error}</Notice> : null}
      <Button
        title={guest ? "حفظ التعديلات" : "حفظ وبدء الإقامة"}
        icon="checkmark"
        busy={busy}
        disabled={!guest && !roomId}
        onPress={() => void save()}
      />
    </Sheet>
  );
}
export function GuestDetail({
  guestId,
  onClose,
  onEdit,
}: {
  guestId: string;
  onClose: () => void;
  onEdit: (g: Guest) => void;
}) {
  const { guests, residents, repo, refresh, rooms, settings } = useStore();
  const guest = guests.find((g) => g.id === guestId);
  const resident = residents.find((g) => g.id === guestId);
  const [history, setHistory] = useState<StayHistory[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [mode, setMode] = useState<"view" | "move" | "return" | "notes">(
    "view",
  );
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(localInput());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([repo.history(guestId), repo.roomHistory(guestId)])
      .then(([stays, rooms]) => {
        if (!cancelled) {
          setHistory(stays);
          setAssignments(rooms);
        }
      })
      .catch(() => {
        if (!cancelled) setError("تعذر تحميل سجل الإقامات.");
      });
    return () => {
      cancelled = true;
    };
  }, [repo, guestId, resident?.stayId, resident?.roomId]);
  if (!guest) return null;
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function checkout() {
    Alert.alert(
      "تسجيل المغادرة",
      `هل غادر ${guest!.fullName} الاستراحة؟ سيُستبعد من الكشوف الجديدة.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد المغادرة",
          style: "destructive",
          onPress: () => void action(() => repo.checkout(resident!.stayId)),
        },
      ],
    );
  }
  return (
    <Sheet visible title="ملف النزيل" onClose={onClose} busy={busy}>
      <Card>
        <Badge
          text={resident ? "مقيم حاليًا" : "إقامة سابقة"}
          tone={resident ? "green" : "gold"}
        />
        <Txt style={[U.h1, { fontSize: 23, marginTop: 15 }]}>
          {guest.fullName}
        </Txt>
        <Txt style={U.caption}>
          {guest.nationality} • {guest.governorate} • {guest.city}
        </Txt>
        {resident ? (
          <Txt style={{ color: C.green, marginTop: 12, fontWeight: "700" }}>
            غرفة {resident.roomLabel}
          </Txt>
        ) : null}
      </Card>
      {mode === "view" ? (
        <>
          <Section title="بيانات الهوية" />
          {[
            ["نوع الهوية", guest.identityType],
            ["الرقم", guest.identityNumber || "غير مسجل"],
            ["جهة الإصدار", guest.identityIssuer || "غير مسجلة"],
            ["تاريخ الإصدار", guest.identityIssuedOn || "غير مسجل"],
          ].map(([k, v]) => (
            <View
              key={k}
              style={[
                U.row,
                { justifyContent: "space-between", paddingVertical: 10 },
              ]}
            >
              <Txt style={U.caption}>{k}</Txt>
              <Txt selectable>{v}</Txt>
            </View>
          ))}
          <Button
            title="تعديل بيانات النزيل"
            kind="secondary"
            icon="create-outline"
            onPress={() => onEdit(guest)}
          />
          <View style={U.divider} />
          {resident ? (
            <View style={{ gap: 10 }}>
              <Button
                title="تعديل ملاحظات الإقامة"
                kind="secondary"
                icon="create-outline"
                onPress={() => {
                  setNotes(resident.notes);
                  setMode("notes");
                }}
              />
              <Button
                title="نقل إلى غرفة أخرى"
                kind="secondary"
                icon="swap-horizontal-outline"
                onPress={() => setMode("move")}
              />
              <Button
                title="تسجيل المغادرة"
                kind="danger"
                icon="log-out-outline"
                busy={busy}
                onPress={checkout}
              />
            </View>
          ) : (
            <Button
              title="بدء إقامة جديدة"
              icon="add"
              onPress={() => setMode("return")}
            />
          )}
          <View style={U.divider} />
          <Section
            title="سجل الإقامات"
            subtitle={`${history.length} إقامة محفوظة`}
          />
          {history.map((h) => (
            <Card key={h.id}>
              <Txt style={{ fontWeight: "700" }}>غرفة {h.roomLabel}</Txt>
              <Txt style={U.caption}>
                الدخول: {dateLabel(h.checkIn, settings.timeZone, true)}
              </Txt>
              <Txt style={U.caption}>
                المغادرة:{" "}
                {h.checkOut
                  ? dateLabel(h.checkOut, settings.timeZone, true)
                  : "الإقامة مستمرة"}
              </Txt>
              {h.notes ? <Txt style={U.caption}>{h.notes}</Txt> : null}
              <View style={U.divider} />
              <Txt style={[U.label, { marginBottom: 8 }]}>حركة الغرف</Txt>
              {assignments
                .filter((a) => a.stayId === h.id)
                .map((a) => (
                  <View
                    key={a.id}
                    style={{
                      borderRightWidth: 2,
                      borderColor: C.line,
                      paddingRight: 12,
                      paddingBottom: 12,
                    }}
                  >
                    <Txt style={{ fontSize: 12, fontWeight: "700" }}>
                      غرفة {a.roomLabel}
                    </Txt>
                    <Txt style={U.caption}>
                      من {dateLabel(a.startedAt, settings.timeZone, true)}
                    </Txt>
                    <Txt style={U.caption}>
                      {a.endedAt
                        ? `إلى ${dateLabel(a.endedAt, settings.timeZone, true)}`
                        : "حتى الآن"}
                    </Txt>
                  </View>
                ))}
            </Card>
          ))}
        </>
      ) : mode === "notes" ? (
        <>
          <Field
            label="ملاحظات الإقامة"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
          />
          <Button
            title="حفظ الملاحظات"
            busy={busy}
            onPress={() =>
              void action(() => repo.updateStayNotes(resident!.stayId, notes))
            }
          />
          <Button title="رجوع" kind="ghost" onPress={() => setMode("view")} />
        </>
      ) : (
        <>
          <Section
            title={mode === "move" ? "اختيار الغرفة الجديدة" : "بيانات العودة"}
            subtitle="تظهر الغرف التي تتوفر بها سعة فقط."
          />
          {rooms
            .filter((r) => r.occupied < r.capacity && r.id !== resident?.roomId)
            .map((r) => (
              <Choice
                key={r.id}
                title={`غرفة ${r.label}`}
                selected={room === r.id}
                subtitle={`${r.occupied} / ${r.capacity}`}
                onPress={() => setRoom(r.id)}
              />
            ))}
          {!rooms.some(
            (r) => r.occupied < r.capacity && r.id !== resident?.roomId,
          ) ? (
            <Notice>لا توجد غرف أخرى متاحة.</Notice>
          ) : null}
          {mode === "return" ? (
            <>
              <Field
                label="تاريخ ووقت الدخول بتوقيت اليمن"
                value={date}
                onChangeText={setDate}
              />
              <Field
                label="ملاحظات الإقامة"
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={1000}
              />
            </>
          ) : null}
          <Button
            title="تأكيد"
            busy={busy}
            disabled={!room}
            onPress={() =>
              void action(() =>
                mode === "move"
                  ? repo.move(resident!.stayId, room)
                  : repo.startStay({
                      guestId,
                      roomId: room,
                      checkIn: inputToInstant(date),
                      notes,
                    }),
              )
            }
          />
          <Button title="رجوع" kind="ghost" onPress={() => setMode("view")} />
        </>
      )}
      {error ? <Notice danger>{error}</Notice> : null}
    </Sheet>
  );
}
export default function Guests({
  onAdd,
  onGuest,
}: {
  onAdd: () => void;
  onGuest: (id: string) => void;
}) {
  const { guests, residents, settings } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"current" | "all">("current");
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [query, filter]);
  const current = new Map(residents.map((g) => [g.id, g]));
  const list = guests.filter(
    (g) =>
      (filter === "all" || current.has(g.id)) &&
      matchesSearch(
        [g.fullName, g.identityNumber, current.get(g.id)?.roomLabel ?? ""],
        query,
      ),
  );
  return (
    <Page
      title="سجل النزلاء"
      kicker="بيانات محفوظة، وإقامات متجددة"
      action={<Button title="إضافة" icon="add" small onPress={onAdd} />}
    >
      <View style={U.search}>
        <Icon name="search-outline" color={C.muted} size={20} />
        <TextInput
          accessibilityLabel="البحث بالاسم أو رقم الهوية أو الغرفة"
          placeholder="الاسم، الهوية أو الغرفة"
          value={query}
          onChangeText={setQuery}
          style={[U.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
        />
      </View>
      <View style={[U.row, { marginBottom: 20 }]}>
        <Button
          title={`المقيمون (${residents.length})`}
          kind={filter === "current" ? "primary" : "secondary"}
          small
          onPress={() => setFilter("current")}
        />
        <Button
          title={`جميع السجلات (${guests.length})`}
          kind={filter === "all" ? "primary" : "secondary"}
          small
          onPress={() => setFilter("all")}
        />
      </View>
      {list.length ? (
        list.slice(0, limit).map((g) => {
          const r = current.get(g.id);
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              onPress={() => onGuest(g.id)}
            >
              <Card>
                <View
                  style={[
                    U.row,
                    {
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: "700", marginBottom: 5 }}>
                      {g.fullName}
                    </Txt>
                    <Txt style={U.caption}>
                      {g.identityType} •{" "}
                      {g.identityNumber || "رقم الهوية غير مسجل"}
                    </Txt>
                  </View>
                  <Icon name="chevron-back" color={C.muted} size={18} />
                </View>
                <View
                  style={[
                    U.row,
                    { justifyContent: "space-between", marginTop: 14 },
                  ]}
                >
                  <Badge
                    text={r ? `غرفة ${r.roomLabel}` : "غادر الاستراحة"}
                    tone={r ? "green" : "gold"}
                  />
                  {r ? (
                    <Txt style={{ fontSize: 10, color: C.muted }}>
                      منذ {dateLabel(r.checkIn, settings.timeZone)}
                    </Txt>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })
      ) : (
        <Empty
          icon="people-outline"
          title={query ? "لا توجد نتائج" : "لا توجد سجلات بعد"}
          body={
            query
              ? "جرّب جزءًا آخر من الاسم أو رقم الهوية."
              : "أضف أول نزيل. سيبقى سجله متاحًا عند عودته."
          }
          action={
            !query ? (
              <Button title="تسجيل نزيل" kind="secondary" onPress={onAdd} />
            ) : undefined
          }
        />
      )}
      {list.length > limit ? (
        <Button
          title={`عرض المزيد (${list.length - limit})`}
          kind="secondary"
          onPress={() => setLimit(limit + 50)}
        />
      ) : null}
    </Page>
  );
}
