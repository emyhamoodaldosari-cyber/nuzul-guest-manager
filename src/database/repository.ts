import type {
  Database,
  Guest,
  GuestInput,
  Resident,
  Room,
  Report,
  ReportSummary,
  Settings,
  StayHistory,
  StayInput,
  RoomAssignment,
  DailyActivity,
} from "../domain/types.ts";
import { SCHEMA } from "./schema.ts";
import {
  clean,
  DEFAULT_SETTINGS,
  UserError,
  validInstant,
  validateGuest,
  validateSettings,
  digits,
} from "../domain/validation.ts";
import { adenDayBounds } from "../domain/dates.ts";
import { matchesSearch } from "../domain/search.ts";
import { backupSchema, type BackupData } from "../security/backup.ts";
import { validateBackupIntegrity } from "../security/integrity.ts";

const guestFields = [
  "fullName",
  "nationality",
  "governorate",
  "city",
  "identityType",
  "identityNumber",
  "identityIssuer",
  "identityIssuedOn",
] as const;
const residentsSql = `SELECT g.*, s.id stayId, s.roomId, r.label roomLabel, s.checkIn, s.notes FROM stays s JOIN guests g ON g.id=s.guestId JOIN rooms r ON r.id=s.roomId WHERE s.checkOut IS NULL ORDER BY r.label COLLATE NOCASE, g.fullName`;

export class Repository {
  private queue: Promise<unknown> = Promise.resolve();
  private db: Database;
  private id: () => string;
  private now: () => string;
  constructor(
    db: Database,
    id: () => string,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.db = db;
    this.id = id;
    this.now = now;
  }
  /** Serialize reads too: no operation can accidentally join another operation's transaction. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async transaction<T>(work: () => Promise<T>) {
    await this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await work();
      await this.db.exec("COMMIT");
      return result;
    } catch (error) {
      await this.db.exec("ROLLBACK");
      throw error;
    }
  }
  initialize() {
    return this.serial(async () => {
      await this.db.exec(
        "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
      );
      const version = await this.db.first<{ user_version: number }>(
        "PRAGMA user_version",
      );
      if ((version?.user_version ?? 0) > 1)
        throw new UserError("قاعدة البيانات أحدث من التطبيق. حدّث التطبيق.");
      await this.transaction(async () => {
        await this.db.exec(SCHEMA);
        await this.db.run(
          "INSERT OR IGNORE INTO settings(id,data) VALUES (1,?)",
          JSON.stringify(DEFAULT_SETTINGS),
        );
      });
    });
  }
  private async guestData(input: GuestInput, exceptId = "") {
    const g = validateGuest(input);
    if (
      g.identityNumber &&
      (await this.db.first(
        "SELECT id FROM guests WHERE identityType=? AND identityNumber=? AND id<>?",
        g.identityType,
        g.identityNumber,
        exceptId,
      ))
    )
      throw new UserError(
        "الهوية مسجلة سابقًا. اختر النزيل من السجل لبدء إقامة جديدة.",
      );
    return g;
  }
  private async roomAvailable(roomId: string) {
    const room = await this.db.first<{ capacity: number; used: number }>(
      "SELECT capacity,(SELECT COUNT(*) FROM stays WHERE roomId=rooms.id AND checkOut IS NULL) used FROM rooms WHERE id=?",
      roomId,
    );
    if (!room) throw new UserError("الغرفة غير موجودة.");
    if (room.used >= room.capacity)
      throw new UserError("الغرفة ممتلئة. اختر غرفة أخرى أو عدّل سعتها.");
  }
  private async insertStay(input: StayInput) {
    if (!validInstant(input.checkIn) || input.checkIn > this.now())
      throw new UserError("وقت الدخول غير صحيح أو يقع في المستقبل.");
    if (
      !(await this.db.first("SELECT id FROM guests WHERE id=?", input.guestId))
    )
      throw new UserError("النزيل غير موجود.");
    if (
      await this.db.first(
        "SELECT id FROM stays WHERE guestId=? AND checkOut IS NULL",
        input.guestId,
      )
    )
      throw new UserError("للنزيل إقامة مفتوحة بالفعل.");
    const latest = await this.db.first<{ checkOut: string }>(
      "SELECT checkOut FROM stays WHERE guestId=? ORDER BY checkOut DESC LIMIT 1",
      input.guestId,
    );
    if (latest && input.checkIn < latest.checkOut)
      throw new UserError("وقت الدخول يتداخل مع إقامة سابقة.");
    if (input.notes.length > 1000) throw new UserError("الملاحظات طويلة جدًا.");
    await this.roomAvailable(input.roomId);
    const id = this.id();
    await this.db.run(
      "INSERT INTO stays(id,guestId,roomId,checkIn,notes) VALUES (?,?,?,?,?)",
      id,
      input.guestId,
      input.roomId,
      input.checkIn,
      clean(input.notes),
    );
    await this.db.run(
      "INSERT INTO room_history(id,stayId,roomId,startedAt) VALUES (?,?,?,?)",
      this.id(),
      id,
      input.roomId,
      input.checkIn,
    );
    return id;
  }
  register(input: GuestInput, stay: Omit<StayInput, "guestId">) {
    return this.serial(() =>
      this.transaction(async () => {
        const g = await this.guestData(input);
        const id = this.id();
        await this.db.run(
          `INSERT INTO guests(id,${guestFields.join(",")},createdAt) VALUES (${Array(10).fill("?").join(",")})`,
          id,
          ...guestFields.map((k) => g[k]),
          this.now(),
        );
        await this.insertStay({ ...stay, guestId: id });
        return id;
      }),
    );
  }
  updateGuest(id: string, input: GuestInput) {
    return this.serial(() =>
      this.transaction(async () => {
        const g = await this.guestData(input, id);
        const result = await this.db.run(
          `UPDATE guests SET ${guestFields.map((k) => `${k}=?`).join(",")} WHERE id=?`,
          ...guestFields.map((k) => g[k]),
          id,
        );
        if (!result.changes) throw new UserError("النزيل غير موجود.");
      }),
    );
  }
  updateStayNotes(stayId: string, notes: string) {
    return this.serial(async () => {
      if (notes.length > 1000) throw new UserError("الملاحظات طويلة جدًا.");
      if (
        !(
          await this.db.run(
            "UPDATE stays SET notes=? WHERE id=? AND checkOut IS NULL",
            clean(notes),
            stayId,
          )
        ).changes
      )
        throw new UserError("الإقامة مغلقة أو غير موجودة.");
    });
  }
  startStay(input: StayInput) {
    return this.serial(() => this.transaction(() => this.insertStay(input)));
  }
  checkout(stayId: string) {
    return this.serial(() =>
      this.transaction(async () => {
        const now = this.now();
        const latest = await this.db.first<{ startedAt: string }>(
          "SELECT startedAt FROM room_history WHERE stayId=? AND endedAt IS NULL",
          stayId,
        );
        if (latest && now < latest.startedAt)
          throw new UserError(
            "وقت الهاتف أقدم من آخر حركة. صحح ساعة الهاتف قبل تسجيل المغادرة.",
          );
        const result = await this.db.run(
          "UPDATE stays SET checkOut=? WHERE id=? AND checkOut IS NULL AND checkIn<=?",
          now,
          stayId,
          now,
        );
        if (!result.changes)
          throw new UserError("الإقامة مغلقة أو غير موجودة.");
        await this.db.run(
          "UPDATE room_history SET endedAt=? WHERE stayId=? AND endedAt IS NULL",
          now,
          stayId,
        );
      }),
    );
  }
  move(stayId: string, roomId: string) {
    return this.serial(() =>
      this.transaction(async () => {
        const stay = await this.db.first<{ roomId: string }>(
          "SELECT roomId FROM stays WHERE id=? AND checkOut IS NULL",
          stayId,
        );
        if (!stay) throw new UserError("الإقامة غير موجودة أو مغلقة.");
        if (stay.roomId === roomId)
          throw new UserError("النزيل في هذه الغرفة بالفعل.");
        await this.roomAvailable(roomId);
        const now = this.now();
        const latest = await this.db.first<{ startedAt: string }>(
          "SELECT startedAt FROM room_history WHERE stayId=? AND endedAt IS NULL",
          stayId,
        );
        if (latest && now < latest.startedAt)
          throw new UserError(
            "وقت الهاتف أقدم من آخر حركة. صحح ساعة الهاتف قبل النقل.",
          );
        await this.db.run(
          "UPDATE room_history SET endedAt=? WHERE stayId=? AND endedAt IS NULL",
          now,
          stayId,
        );
        await this.db.run(
          "INSERT INTO room_history(id,stayId,roomId,startedAt) VALUES (?,?,?,?)",
          this.id(),
          stayId,
          roomId,
          now,
        );
        await this.db.run(
          "UPDATE stays SET roomId=? WHERE id=?",
          roomId,
          stayId,
        );
      }),
    );
  }
  saveRoom(label: string, capacity: number, id?: string) {
    return this.serial(() =>
      this.transaction(async () => {
        label = digits(clean(label));
        if (
          !label ||
          label.length > 40 ||
          !Number.isInteger(capacity) ||
          capacity < 1 ||
          capacity > 500
        )
          throw new UserError("أدخل اسم غرفة وسعة بين ١ و٥٠٠.");
        if (
          await this.db.first(
            "SELECT id FROM rooms WHERE label=? AND id<>?",
            label,
            id ?? "",
          )
        )
          throw new UserError("اسم الغرفة مستخدم.");
        if (id) {
          const r = await this.db.first<{ used: number }>(
            "SELECT COUNT(*) used FROM stays WHERE roomId=? AND checkOut IS NULL",
            id,
          );
          if ((r?.used ?? 0) > capacity)
            throw new UserError("السعة أقل من عدد المقيمين الحاليين.");
          if (
            !(
              await this.db.run(
                "UPDATE rooms SET label=?,capacity=? WHERE id=?",
                label,
                capacity,
                id,
              )
            ).changes
          )
            throw new UserError("الغرفة غير موجودة.");
        } else
          await this.db.run(
            "INSERT INTO rooms(id,label,capacity) VALUES (?,?,?)",
            this.id(),
            label,
            capacity,
          );
      }),
    );
  }
  addRoomRange(start: number, end: number, capacity: number, prefix = "") {
    return this.serial(() =>
      this.transaction(async () => {
        prefix = clean(prefix);
        if (
          !Number.isInteger(start) ||
          !Number.isInteger(end) ||
          start < 0 ||
          end < start ||
          end > 99999 ||
          end - start >= 200 ||
          prefix.length > 30
        )
          throw new UserError("أدخل نطاقًا صحيحًا لا يزيد على ٢٠٠ غرفة.");
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)
          throw new UserError("سعة الغرفة بين ١ و٥٠٠.");
        for (let number = start; number <= end; number++) {
          const label = digits(`${prefix}${number}`);
          if (await this.db.first("SELECT id FROM rooms WHERE label=?", label))
            throw new UserError(
              `الغرفة ${label} موجودة بالفعل. لم تُضف أي غرفة من هذه الدفعة.`,
            );
          await this.db.run(
            "INSERT INTO rooms(id,label,capacity) VALUES (?,?,?)",
            this.id(),
            label,
            capacity,
          );
        }
        return end - start + 1;
      }),
    );
  }
  deleteUnusedRoom(id: string) {
    return this.serial(() =>
      this.transaction(async () => {
        if (
          (await this.db.first(
            "SELECT id FROM room_history WHERE roomId=? LIMIT 1",
            id,
          )) ||
          (await this.db.first(
            "SELECT id FROM stays WHERE roomId=? LIMIT 1",
            id,
          ))
        )
          throw new UserError(
            "لا يمكن حذف غرفة لها سجل إقامة. يمكنك تعديل اسمها أو سعتها.",
          );
        if (!(await this.db.run("DELETE FROM rooms WHERE id=?", id)).changes)
          throw new UserError("الغرفة غير موجودة.");
      }),
    );
  }
  residents() {
    return this.serial(() => this.db.all<Resident>(residentsSql));
  }
  guests(query = "") {
    return this.serial(async () =>
      (
        await this.db.all<Guest>("SELECT * FROM guests ORDER BY fullName")
      ).filter((g) => matchesSearch([g.fullName, g.identityNumber], query)),
    );
  }
  rooms() {
    return this.serial(async () =>
      (
        await this.db.all<Room>(
          `SELECT r.*, (SELECT COUNT(*) FROM stays s WHERE s.roomId=r.id AND s.checkOut IS NULL) occupied,
      (SELECT COUNT(*) FROM room_history h WHERE h.roomId=r.id) historyCount FROM rooms r`,
        )
      ).sort((a, b) => a.label.localeCompare(b.label, "ar", { numeric: true })),
    );
  }
  roomHistory(guestId: string) {
    return this.serial(() =>
      this.db.all<RoomAssignment>(
        `SELECT h.id,h.stayId,r.label roomLabel,h.startedAt,h.endedAt FROM room_history h JOIN stays s ON s.id=h.stayId JOIN rooms r ON r.id=h.roomId WHERE s.guestId=? ORDER BY h.startedAt,h.rowid`,
        guestId,
      ),
    );
  }
  dailyActivity(iso = this.now()) {
    return this.serial(async () => {
      const { start, end } = adenDayBounds(iso);
      return (await this.db.first<DailyActivity>(
        `SELECT
      (SELECT COUNT(*) FROM stays WHERE checkIn>=? AND checkIn<?) arrivals,
      (SELECT COUNT(*) FROM stays WHERE checkOut>=? AND checkOut<?) departures`,
        start,
        end,
        start,
        end,
      ))!;
    });
  }
  history(guestId: string) {
    return this.serial(() =>
      this.db.all<StayHistory>(
        "SELECT s.id,r.label roomLabel,s.checkIn,s.checkOut,s.notes FROM stays s JOIN rooms r ON r.id=s.roomId WHERE guestId=? ORDER BY checkIn DESC",
        guestId,
      ),
    );
  }
  settings() {
    return this.serial(
      async () =>
        JSON.parse(
          (await this.db.first<{ data: string }>(
            "SELECT data FROM settings WHERE id=1",
          ))!.data,
        ) as Settings,
    );
  }
  saveSettings(s: Settings) {
    return this.serial(async () => {
      const data = validateSettings(s);
      await this.db.run(
        "UPDATE settings SET data=? WHERE id=1",
        JSON.stringify(data),
      );
    });
  }
  issueReport(expectedFingerprint: string) {
    return this.serial(() =>
      this.transaction(async () => {
        const entries = await this.db.all<Resident>(residentsSql);
        if (!entries.length)
          throw new UserError("لا يوجد نزلاء مقيمون لإصدار الكشف.");
        const issuedAt = this.now();
        const latest = await this.db.first<{ startedAt: string }>(
          "SELECT MAX(startedAt) startedAt FROM room_history WHERE endedAt IS NULL",
        );
        if (latest?.startedAt && latest.startedAt > issuedAt)
          throw new UserError(
            "وقت الهاتف أقدم من آخر حركة إقامة. صحح ساعة الهاتف قبل إصدار الكشف.",
          );
        const settings = JSON.parse(
          (await this.db.first<{ data: string }>(
            "SELECT data FROM settings WHERE id=1",
          ))!.data,
        ) as Settings;
        if (JSON.stringify({ entries, settings }) !== expectedFingerprint)
          throw new UserError(
            "تغيرت البيانات منذ المعاينة. حدّث الكشف وراجعه مجددًا.",
          );
        const report: Report = {
          id: this.id(),
          issuedAt,
          settings: validateSettings(settings),
          entries,
          version: 1,
        };
        await this.db.run(
          "INSERT INTO reports(id,issuedAt,count,snapshot) VALUES (?,?,?,?)",
          report.id,
          report.issuedAt,
          entries.length,
          JSON.stringify(report),
        );
        return report;
      }),
    );
  }
  reportPreview() {
    return this.serial(async () => {
      const entries = await this.db.all<Resident>(residentsSql);
      const settings = JSON.parse(
        (await this.db.first<{ data: string }>(
          "SELECT data FROM settings WHERE id=1",
        ))!.data,
      ) as Settings;
      return {
        entries,
        settings,
        fingerprint: JSON.stringify({ entries, settings }),
      };
    });
  }
  reports() {
    return this.serial(() =>
      this.db.all<ReportSummary>(
        "SELECT id,issuedAt,count FROM reports ORDER BY issuedAt DESC",
      ),
    );
  }
  report(id: string) {
    return this.serial(async () => {
      const row = await this.db.first<{ snapshot: string }>(
        "SELECT snapshot FROM reports WHERE id=?",
        id,
      );
      if (!row) throw new UserError("التقرير غير موجود.");
      return JSON.parse(row.snapshot) as Report;
    });
  }
  exportData() {
    return this.serial(() =>
      this.transaction(async () => ({
        format: "nuzul-data" as const,
        version: 1 as const,
        guests: await this.db.all<BackupData["guests"][number]>(
          "SELECT * FROM guests",
        ),
        rooms: await this.db.all<BackupData["rooms"][number]>(
          "SELECT * FROM rooms",
        ),
        stays: await this.db.all<BackupData["stays"][number]>(
          "SELECT * FROM stays",
        ),
        history: await this.db.all<BackupData["history"][number]>(
          "SELECT * FROM room_history ORDER BY rowid",
        ),
        reports: await this.db.all<BackupData["reports"][number]>(
          "SELECT * FROM reports",
        ),
        settings: JSON.parse(
          (await this.db.first<{ data: string }>(
            "SELECT data FROM settings WHERE id=1",
          ))!.data,
        ) as Settings,
      })),
    );
  }
  /** Restore is intentionally non-destructive: only an empty installation accepts a backup. */
  restoreData(input: unknown) {
    return this.serial(() =>
      this.transaction(async () => {
        const parsed = backupSchema.safeParse(input);
        if (!parsed.success)
          throw new UserError("بنية النسخة الاحتياطية غير صالحة.");
        const data = parsed.data;
        validateBackupIntegrity(data);
        for (const table of ["guests", "rooms", "stays", "reports"])
          if (await this.db.first(`SELECT id FROM ${table} LIMIT 1`))
            throw new UserError(
              "الاستعادة متاحة على تثبيت فارغ فقط، قبل إضافة الغرف والنزلاء. لن تُستبدل بياناتك الحالية.",
            );
        validateSettings(data.settings);
        for (const r of data.rooms)
          await this.db.run(
            "INSERT INTO rooms(id,label,capacity) VALUES (?,?,?)",
            r.id,
            r.label,
            r.capacity,
          );
        for (const g of data.guests) {
          const validated = validateGuest(g);
          await this.db.run(
            `INSERT INTO guests(id,${guestFields.join(",")},createdAt) VALUES (${Array(10).fill("?").join(",")})`,
            g.id,
            ...guestFields.map((k) => validated[k]),
            g.createdAt,
          );
        }
        for (const s of data.stays)
          await this.db.run(
            "INSERT INTO stays(id,guestId,roomId,checkIn,checkOut,notes) VALUES (?,?,?,?,?,?)",
            s.id,
            s.guestId,
            s.roomId,
            s.checkIn,
            s.checkOut,
            s.notes,
          );
        for (const h of data.history)
          await this.db.run(
            "INSERT INTO room_history(id,stayId,roomId,startedAt,endedAt) VALUES (?,?,?,?,?)",
            h.id,
            h.stayId,
            h.roomId,
            h.startedAt,
            h.endedAt,
          );
        for (const r of data.reports) {
          const report = JSON.parse(r.snapshot) as Report;
          if (
            report.id !== r.id ||
            report.issuedAt !== r.issuedAt ||
            report.entries.length !== r.count
          )
            throw new UserError("فشل اتساق أرشيف التقارير.");
          await this.db.run(
            "INSERT INTO reports(id,issuedAt,count,snapshot) VALUES (?,?,?,?)",
            r.id,
            r.issuedAt,
            r.count,
            r.snapshot,
          );
        }
        if (
          await this.db.first(
            "SELECT id FROM rooms WHERE (SELECT COUNT(*) FROM stays WHERE roomId=rooms.id AND checkOut IS NULL)>capacity",
          )
        )
          throw new UserError("النسخة تحتوي على إشغال يتجاوز سعة الغرف.");
        if (
          await this.db.first(
            `SELECT s.id FROM stays s WHERE (s.checkOut IS NULL AND (SELECT COUNT(*) FROM room_history h WHERE h.stayId=s.id AND h.endedAt IS NULL AND h.roomId=s.roomId)<>1) OR (s.checkOut IS NOT NULL AND EXISTS(SELECT 1 FROM room_history h WHERE h.stayId=s.id AND h.endedAt IS NULL))`,
          )
        )
          throw new UserError("فشل اتساق سجل الغرف والإقامات.");
        await this.db.run(
          "UPDATE settings SET data=? WHERE id=1",
          JSON.stringify(data.settings),
        );
      }),
    );
  }
}
