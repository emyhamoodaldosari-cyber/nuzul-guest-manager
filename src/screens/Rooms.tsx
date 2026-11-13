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
import type { Room } from "../domain/types.ts";
import { digits } from "../domain/validation.ts";
export default function Rooms({ onGuest }: { onGuest: (id: string) => void }) {
  const { rooms, residents, repo, refresh } = useStore();
  const [edit, setEdit] = useState<Room | null | undefined>(undefined);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bulk, setBulk] = useState(false);
  const [start, setStart] = useState("101");
  const [end, setEnd] = useState("110");
  const [prefix, setPrefix] = useState("");
  function open(room: Room | null) {
    setEdit(room);
    setLabel(room?.label ?? "");
    setCapacity(String(room?.capacity ?? 1));
    setError("");
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await repo.saveRoom(label, Number(digits(capacity)), edit?.id);
      await refresh();
      setEdit(undefined);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function addBatch() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await repo.addRoomRange(
        Number(digits(start)),
        Number(digits(end)),
        Number(digits(capacity)),
        prefix,
      );
      await refresh();
      setBulk(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function remove() {
    if (!edit || busy) return;
    const room = edit;
    Alert.alert("حذف الغرفة", `حذف الغرفة ${room.label} من قائمة الغرف؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void repo
            .deleteUnusedRoom(room.id)
            .then(refresh)
            .then(() => setEdit(undefined))
            .catch((e) => setError(message(e)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }
  return (
    <>
      <Page
        title="الغرف والإشغال"
        kicker="مساحة لكل نزيل"
        action={
          <Button title="غرفة" icon="add" small onPress={() => open(null)} />
        }
      >
        <View style={[U.row, { marginBottom: 20 }]}>
          <Badge text={`${rooms.length} غرفة`} />
          <Badge
            text={`${rooms.reduce((n, r) => n + r.capacity, 0)} سعة إجمالية`}
            tone="gold"
          />
        </View>
        <View style={{ marginBottom: 18 }}>
          <Button
            title="إضافة غرف متسلسلة دفعة واحدة"
            icon="duplicate-outline"
            kind="secondary"
            onPress={() => {
              setCapacity("1");
              setError("");
              setBulk(true);
            }}
          />
        </View>
        {!rooms.length ? (
          <Empty
            icon="bed-outline"
            title="أضف غرف الاستراحة"
            body="حدد رقم كل غرفة وسعتها. يمكن لأكثر من نزيل مستقل مشاركة الغرفة."
            action={
              <Button
                title="إضافة أول غرفة"
                kind="secondary"
                onPress={() => open(null)}
              />
            }
          />
        ) : (
          rooms.map((r) => (
            <Card key={r.id}>
              <View style={[U.row, { justifyContent: "space-between" }]}>
                <View style={U.row}>
                  <View style={U.emptyIcon}>
                    <Icon name="bed-outline" color={C.green} />
                  </View>
                  <View>
                    <Txt style={U.h2}>غرفة {r.label}</Txt>
                    <Txt style={U.caption}>
                      {r.occupied} من {r.capacity} مقيم
                    </Txt>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel={`تعديل غرفة ${r.label}`}
                  onPress={() => open(r)}
                  style={U.iconButton}
                >
                  <Icon name="create-outline" size={19} />
                </Pressable>
              </View>
              <View
                style={{
                  height: 5,
                  backgroundColor: C.mint,
                  borderRadius: 3,
                  marginTop: 17,
                  overflow: "hidden",
                  alignItems: "flex-end",
                }}
              >
                <View
                  style={{
                    height: 5,
                    width: `${(100 * r.occupied) / r.capacity}%`,
                    backgroundColor:
                      r.occupied === r.capacity ? C.gold : C.green,
                  }}
                />
              </View>
              <View style={[U.row, { marginTop: 14 }]}>
                <Badge
                  text={
                    r.occupied === 0
                      ? "فارغة"
                      : r.occupied === r.capacity
                        ? "ممتلئة"
                        : "متاحة"
                  }
                  tone={r.occupied === r.capacity ? "gold" : "green"}
                />
              </View>
              {residents
                .filter((g) => g.roomId === r.id)
                .map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => onGuest(g.id)}
                    style={[
                      U.row,
                      {
                        borderTopWidth: 1,
                        borderColor: C.line,
                        paddingTop: 12,
                        marginTop: 12,
                      },
                    ]}
                  >
                    <Icon name="person-outline" size={16} color={C.muted} />
                    <Txt style={{ flex: 1, fontSize: 12 }}>{g.fullName}</Txt>
                    <Icon name="chevron-back" size={14} color={C.muted} />
                  </Pressable>
                ))}
            </Card>
          ))
        )}
      </Page>
      <Sheet
        visible={edit !== undefined}
        title={edit ? "تعديل الغرفة" : "إضافة غرفة"}
        onClose={() => setEdit(undefined)}
        busy={busy}
      >
        <Section
          title="بيانات الغرفة"
          subtitle="السعة هي عدد النزلاء الأفراد الذين يمكن تسجيلهم فيها."
        />
        <Field
          label="رقم / اسم الغرفة"
          required
          value={label}
          onChangeText={setLabel}
          placeholder="مثال: ١٠١ أو اللوكندة"
          maxLength={40}
        />
        <Field
          label="السعة"
          required
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          maxLength={3}
        />
        {error ? <Notice danger>{error}</Notice> : null}
        <Button
          title="حفظ الغرفة"
          busy={busy}
          icon="checkmark"
          onPress={() => void save()}
        />
        {edit && edit.historyCount === 0 ? (
          <View style={{ marginTop: 14 }}>
            <Button
              title="حذف الغرفة غير المستخدمة"
              kind="danger"
              icon="trash-outline"
              disabled={busy}
              onPress={remove}
            />
          </View>
        ) : edit ? (
          <Txt style={[U.caption, { marginTop: 14 }]}>
            هذه الغرفة لها سجل إقامة، لذا يُحتفظ بها في الأرشيف.
          </Txt>
        ) : null}
      </Sheet>
      <Sheet
        visible={bulk}
        title="إضافة مجموعة غرف"
        busy={busy}
        onClose={() => setBulk(false)}
      >
        <Section
          title="أضف حتى ٢٠٠ غرفة بخطوة واحدة"
          subtitle="إذا تكرر اسم غرفة، تتوقف الدفعة كاملة دون إضافة جزئية."
        />
        <Field
          label="من رقم"
          value={start}
          onChangeText={setStart}
          keyboardType="number-pad"
          maxLength={5}
        />
        <Field
          label="إلى رقم"
          value={end}
          onChangeText={setEnd}
          keyboardType="number-pad"
          maxLength={5}
        />
        <Field
          label="بادئة اختيارية"
          value={prefix}
          onChangeText={setPrefix}
          placeholder="مثال: جناح أ - "
          maxLength={30}
        />
        <Field
          label="سعة كل غرفة"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          maxLength={3}
        />
        {error ? <Notice danger>{error}</Notice> : null}
        <Button
          title="إضافة الغرف"
          icon="checkmark"
          busy={busy}
          disabled={!start.trim() || !end.trim() || !capacity.trim()}
          onPress={() => void addBatch()}
        />
      </Sheet>
    </>
  );
}
