import React, { Component, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import { usePreventScreenCapture } from "expo-screen-capture";
import { openRepository } from "./src/database/native.ts";
import type { Repository } from "./src/database/repository.ts";
import { Store, useStore, message } from "./src/components/store.tsx";
import {
  Badge,
  Button,
  C,
  Icon,
  Notice,
  Txt,
  U,
  PrivacyContext,
  type IconName,
} from "./src/components/ui.tsx";
import Dashboard from "./src/screens/Dashboard.tsx";
import Guests, { GuestDetail, GuestForm } from "./src/screens/Guests.tsx";
import Rooms from "./src/screens/Rooms.tsx";
import Reports from "./src/screens/Reports.tsx";
import Settings from "./src/screens/Settings.tsx";
import type { Guest } from "./src/domain/types.ts";
type Tab = "home" | "guests" | "rooms" | "reports" | "settings";
const tabs: { id: Tab; title: string; icon: IconName }[] = [
  { id: "home", title: "الرئيسية", icon: "grid-outline" },
  { id: "guests", title: "النزلاء", icon: "people-outline" },
  { id: "rooms", title: "الغرف", icon: "bed-outline" },
  { id: "reports", title: "الكشوف", icon: "document-text-outline" },
  { id: "settings", title: "الإعدادات", icon: "settings-outline" },
];
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.cream,
          justifyContent: "center",
          padding: 30,
        }}
      >
        <Txt style={U.h1}>تعذر عرض التطبيق</Txt>
        <Txt style={[U.caption, { marginVertical: 20 }]}>
          أغلق التطبيق وأعد فتحه. لا تحذف التطبيق أو بياناته.
        </Txt>
      </SafeAreaView>
    ) : (
      this.props.children
    );
  }
}
function Shell({ lock }: { lock: () => void }) {
  const { loading, error, refresh, settings } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [add, setAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<Guest | null>(null);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);
  const onGuest = (id: string) => setSelected(id);
  const onAdd = () => setAdd(true);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.cream }}
      edges={["top", "bottom"]}
    >
      <StatusBar style="dark" />
      <View
        style={[
          U.row,
          {
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: 15,
            borderBottomWidth: 1,
            borderColor: C.line,
            justifyContent: "space-between",
          },
        ]}
      >
        <View style={U.row}>
          <View
            style={{
              width: 39,
              height: 42,
              backgroundColor: C.green,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="business-outline" size={22} color={C.white} />
          </View>
          <View>
            <Txt style={{ fontSize: 23, fontWeight: "800" }}>نُزل</Txt>
            <Txt
              numberOfLines={1}
              style={{ fontSize: 9, color: C.muted, maxWidth: 210 }}
            >
              {settings.propertyName}
            </Txt>
          </View>
        </View>
        <Pressable
          accessibilityLabel="قفل التطبيق"
          accessibilityRole="button"
          onPress={lock}
          style={U.iconButton}
        >
          <Icon name="lock-closed-outline" size={18} />
        </Pressable>
      </View>
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={C.green} />
        </View>
      ) : error ? (
        <View style={{ padding: 22, flex: 1 }}>
          <Notice danger>{error}</Notice>
          <Button
            title="إعادة المحاولة"
            onPress={() => void refresh().catch(() => {})}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {tab === "home" ? (
            <Dashboard
              onAdd={onAdd}
              onGuest={onGuest}
              onGuests={() => setTab("guests")}
              onRooms={() => setTab("rooms")}
              onReports={() => setTab("reports")}
              onSettings={() => setTab("settings")}
            />
          ) : tab === "guests" ? (
            <Guests onAdd={onAdd} onGuest={onGuest} />
          ) : tab === "rooms" ? (
            <Rooms onGuest={onGuest} />
          ) : tab === "reports" ? (
            <Reports />
          ) : (
            <Settings />
          )}
        </View>
      )}
      <View
        style={[
          U.row,
          {
            gap: 0,
            backgroundColor: C.white,
            borderTopWidth: 1,
            borderColor: C.line,
            paddingTop: 8,
            paddingBottom: 5,
          },
        ]}
      >
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            accessibilityLabel={t.title}
            onPress={() => setTab(t.id)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 4,
              paddingVertical: 7,
            }}
          >
            <View
              style={{
                paddingHorizontal: 15,
                paddingVertical: 5,
                borderRadius: 12,
                backgroundColor: tab === t.id ? C.mint : "transparent",
              }}
            >
              <Icon
                name={t.icon}
                color={tab === t.id ? C.green : C.muted}
                size={21}
              />
            </View>
            <Txt
              style={{
                fontSize: 10,
                color: tab === t.id ? C.green : C.muted,
                fontWeight: tab === t.id ? "700" : "400",
              }}
            >
              {t.title}
            </Txt>
          </Pressable>
        ))}
      </View>
      {add ? <GuestForm onClose={() => setAdd(false)} /> : null}
      {selected ? (
        <GuestDetail
          guestId={selected}
          onClose={() => setSelected(null)}
          onEdit={(g) => {
            setSelected(null);
            setEdit(g);
          }}
        />
      ) : null}
      {edit ? <GuestForm guest={edit} onClose={() => setEdit(null)} /> : null}
    </SafeAreaView>
  );
}
function SecureApp() {
  usePreventScreenCapture("nuzul-private");
  const [unlocked, setUnlocked] = useState(false);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const authenticating = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && !authenticating.current) setUnlocked(false);
    });
    return () => sub.remove();
  }, []);
  async function unlock() {
    if (authenticating.current) return;
    authenticating.current = true;
    setBusy(true);
    setError("");
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE)
        throw new Error(
          "فعّل قفل الشاشة برمز أو بصمة من إعدادات أندرويد، ثم عد لفتح التطبيق.",
        );
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: "فتح سجل الاستراحة",
        promptDescription: "استخدم بصمتك أو رمز قفل الهاتف",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
        biometricsSecurityLevel: "strong",
      });
      if (!auth.success) {
        setError("لم يُفتح القفل. يمكنك المحاولة مجددًا.");
        return;
      }
      const database = await openRepository();
      setRepo(database);
      if (AppState.currentState === "active") setUnlocked(true);
    } catch (e) {
      setError(message(e));
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }
  return (
    <PrivacyContext.Provider value={unlocked}>
      <View style={{ flex: 1 }}>
        {repo ? (
          <View style={{ flex: 1, display: unlocked ? "flex" : "none" }}>
            <Store repo={repo}>
              <Shell lock={() => setUnlocked(false)} />
            </Store>
          </View>
        ) : null}
        {!unlocked ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
            <StatusBar style="dark" />
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                padding: 32,
                gap: 18,
              }}
            >
              <View
                style={{
                  width: 84,
                  height: 84,
                  backgroundColor: C.ink,
                  borderRadius: 27,
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "center",
                  marginBottom: 5,
                }}
              >
                <Icon name="business-outline" color="#DFECDD" size={40} />
              </View>
              <Txt
                style={{ fontSize: 44, fontWeight: "800", textAlign: "center" }}
              >
                نُزل
              </Txt>
              <Txt style={[U.h2, { textAlign: "center" }]}>
                إدارة استراحتك، بأمان وهدوء.
              </Txt>
              <Txt
                style={[U.caption, { textAlign: "center", marginBottom: 20 }]}
              >
                سجّل النزلاء مرة واحدة، وأصدر معلومية اليوم من سجلات الإقامة
                المحفوظة.
              </Txt>
              {error ? <Notice danger>{error}</Notice> : null}
              <Button
                title="فتح التطبيق"
                icon="finger-print-outline"
                busy={busy}
                onPress={() => void unlock()}
              />
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Badge text="يعمل دون إنترنت • تخزين محلي مشفّر" />
              </View>
            </View>
            <Txt
              style={[
                U.caption,
                { textAlign: "center", paddingBottom: 25, fontSize: 10 },
              ]}
            >
              البيانات تبقى على جهازك. المشاركة بإرادتك.
            </Txt>
          </SafeAreaView>
        ) : null}
      </View>
    </PrivacyContext.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SecureApp />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
