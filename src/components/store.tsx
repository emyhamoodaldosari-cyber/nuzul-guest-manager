import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Repository } from "../database/repository.ts";
import type {
  Guest,
  Resident,
  Room,
  ReportSummary,
  Settings,
  DailyActivity,
} from "../domain/types.ts";
import { DEFAULT_SETTINGS } from "../domain/validation.ts";
interface State {
  residents: Resident[];
  guests: Guest[];
  rooms: Room[];
  reports: ReportSummary[];
  settings: Settings;
  activity: DailyActivity;
}
const initial: State = {
  residents: [],
  guests: [],
  rooms: [],
  reports: [],
  settings: DEFAULT_SETTINGS,
  activity: { arrivals: 0, departures: 0 },
};
const Context = createContext<
  | ({
      repo: Repository;
      refresh: () => Promise<void>;
      loading: boolean;
      error: string | null;
    } & State)
  | null
>(null);
export function Store({
  repo,
  children,
}: {
  repo: Repository;
  children: React.ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [residents, guests, rooms, reports, settings, activity] =
        await Promise.all([
          repo.residents(),
          repo.guests(),
          repo.rooms(),
          repo.reports(),
          repo.settings(),
          repo.dailyActivity(),
        ]);
      setState({ residents, guests, rooms, reports, settings, activity });
      setError(null);
    } catch {
      setError("تعذر تحديث البيانات. حاول مجددًا.");
      throw new Error("تعذر تحديث البيانات");
    } finally {
      setLoading(false);
    }
  }, [repo]);
  useEffect(() => {
    void refresh().catch(() => {});
    const timer = setInterval(() => void refresh().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <Context.Provider value={{ ...state, repo, refresh, loading, error }}>
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing Store");
  return ctx;
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "تعذر إتمام العملية. حاول مجددًا.";
}
