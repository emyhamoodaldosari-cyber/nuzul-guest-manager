import React from "react";
import { View, Pressable } from "react-native";
import { useStore } from "../components/store.tsx";
import {
  Badge,
  Button,
  C,
  Card,
  Empty,
  Icon,
  Page,
  Section,
  Txt,
  U,
} from "../components/ui.tsx";
import { dateLabel } from "../reports/template.ts";
export default function Dashboard({
  onAdd,
  onGuests,
  onRooms,
  onReports,
  onGuest,
  onSettings,
}: {
  onAdd: () => void;
  onGuests: () => void;
  onRooms: () => void;
  onReports: () => void;
  onGuest: (id: string) => void;
  onSettings: () => void;
}) {
  const { residents, rooms, reports, settings, activity } = useStore();
  const occupied = rooms.filter((r) => r.occupied > 0).length;
  const today = dateLabel(new Date().toISOString(), settings.timeZone);
  const todayReport = reports.find(
    (r) => dateLabel(r.issuedAt, settings.timeZone) === today,
  );
  return (
    <Page
      title="يومٌ منظّم، بكل بساطة."
      kicker={`${new Intl.DateTimeFormat("ar-YE", { weekday: "long", day: "numeric", month: "long", timeZone: settings.timeZone }).format(new Date())}  /  لوحة المتابعة`}
    >
      {!rooms.length ? (
        <Card>
          <Section
            title="ابدأ تجهيز استراحتك"
            subtitle="راجع بيانات المنشأة، ثم أضف الغرف وسجّل أول نزيل."
          />
          <View style={{ gap: 10 }}>
            <Button
              title="١. مراجعة بيانات الاستراحة"
              kind="secondary"
              icon="settings-outline"
              onPress={onSettings}
            />
            <Button
              title="٢. إضافة الغرف"
              kind="ghost"
              icon="bed-outline"
              onPress={onRooms}
            />
          </View>
        </Card>
      ) : null}
      <View
        style={{
          backgroundColor: C.ink,
          borderRadius: 22,
          padding: 23,
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <View style={[U.row, { justifyContent: "space-between" }]}>
          <Txt style={{ color: "#BCD3C4", fontSize: 12 }}>
            النزلاء الموجودون الآن
          </Txt>
          <View
            style={{ backgroundColor: "#355A4B", borderRadius: 12, padding: 9 }}
          >
            <Icon name="people-outline" color="#D7E7D9" />
          </View>
        </View>
        <View style={[U.row, { alignItems: "baseline", marginTop: 8 }]}>
          <Txt style={{ fontSize: 56, fontWeight: "700", color: C.white }}>
            {residents.length.toLocaleString("ar")}
          </Txt>
          <Txt style={{ color: "#BDD0C4" }}>نزيل مقيم</Txt>
        </View>
        <Txt
          style={{
            fontSize: 12,
            color: "#BDD0C4",
            lineHeight: 22,
            marginBottom: 20,
          }}
        >
          سجّل مرة واحدة. وسيظهر المقيمون تلقائيًا في كشفك اليومي.
        </Txt>
        <Button
          title="تسجيل نزيل"
          icon="add"
          kind="secondary"
          onPress={onAdd}
        />
      </View>
      <View style={[U.row, { gap: 12, marginBottom: 11 }]}>
        {[
          {
            label: "غرفة مشغولة",
            value: occupied,
            icon: "bed-outline" as const,
          },
          {
            label: "غرفة فارغة",
            value: rooms.length - occupied,
            icon: "key-outline" as const,
          },
        ].map((x) => (
          <Pressable key={x.label} onPress={onRooms} style={{ flex: 1 }}>
            <Card style={{ padding: 17 }}>
              <View style={[U.row, { justifyContent: "space-between" }]}>
                <Icon name={x.icon} size={20} color={C.green} />
                <Txt style={{ fontSize: 28, fontWeight: "700" }}>
                  {x.value.toLocaleString("ar")}
                </Txt>
              </View>
              <Txt style={[U.caption, { marginTop: 7 }]}>{x.label}</Txt>
            </Card>
          </Pressable>
        ))}
      </View>
      <View style={[U.row, { marginBottom: 18 }]}>
        <View style={{ flex: 1 }}>
          <Card>
            <Txt style={U.caption}>دخول اليوم</Txt>
            <Txt style={{ fontSize: 26, fontWeight: "700", color: C.green }}>
              {activity.arrivals.toLocaleString("ar")}
            </Txt>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Txt style={U.caption}>مغادرة اليوم</Txt>
            <Txt style={{ fontSize: 26, fontWeight: "700", color: C.gold }}>
              {activity.departures.toLocaleString("ar")}
            </Txt>
          </Card>
        </View>
      </View>
      <Section
        title="معلومية اليوم"
        subtitle="كشف بجميع المقيمين وقت الإصدار"
      />
      <Card>
        <View style={[U.row, { alignItems: "flex-start", marginBottom: 15 }]}>
          <View style={U.emptyIcon}>
            <Icon name="document-text-outline" color={C.green} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Txt style={{ fontWeight: "700" }}>تقرير البحث الجنائي</Txt>
            <Badge
              text={todayReport ? "صدر كشف اليوم" : "بانتظار الإصدار"}
              tone={todayReport ? "green" : "gold"}
            />
          </View>
        </View>
        <Button
          title={todayReport ? "معاينة وإصدار كشف محدّث" : "مراجعة وإصدار الكشف"}
          icon="arrow-back-outline"
          kind="secondary"
          onPress={onReports}
        />
      </Card>
      <Section
        title="النزلاء الحاليون"
        action={
          <Button title="عرض الكل" small kind="ghost" onPress={onGuests} />
        }
      />
      {!residents.length ? (
        <Empty
          icon="people-outline"
          title="السجل جاهز لاستقبال أول نزيل"
          body={
            rooms.length
              ? "أضف النزيل وبيانات إقامته لبدء العمل."
              : "ابدأ بإضافة الغرف وسعتها، ثم سجّل أول نزيل."
          }
          action={
            <Button
              title={rooms.length ? "إضافة نزيل" : "إعداد الغرف"}
              kind="secondary"
              onPress={rooms.length ? onAdd : onRooms}
            />
          }
        />
      ) : (
        residents.slice(0, 4).map((g) => (
          <Pressable key={g.id} onPress={() => onGuest(g.id)}>
            <Card style={{ padding: 15 }}>
              <View style={U.row}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: C.mint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt
                    style={{ color: C.green, fontWeight: "700", fontSize: 18 }}
                  >
                    {g.fullName.slice(0, 1)}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: "700", fontSize: 13 }}>
                    {g.fullName}
                  </Txt>
                  <Txt style={U.caption}>
                    غرفة {g.roomLabel} •{" "}
                    {dateLabel(g.checkIn, settings.timeZone)}
                  </Txt>
                </View>
                <Icon name="chevron-back" size={17} color={C.muted} />
              </View>
            </Card>
          </Pressable>
        ))
      )}
      <View style={[U.row, { justifyContent: "center", marginTop: 10 }]}>
        <Icon name="shield-checkmark-outline" size={14} color={C.muted} />
        <Txt style={{ fontSize: 10, color: C.muted }}>
          بياناتك محفوظة محليًا على هذا الجهاز
        </Txt>
      </View>
    </Page>
  );
}
