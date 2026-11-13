import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes } from "node:crypto";
import { Repository } from "../src/database/repository.ts";
import type { Database, GuestInput, Report } from "../src/domain/types.ts";
import { DEFAULT_SETTINGS, validateGuest } from "../src/domain/validation.ts";
import {
  inputToInstant,
  dateKey,
  isInReportPeriod,
} from "../src/domain/dates.ts";
import { matchesSearch } from "../src/domain/search.ts";
import { reportFileName } from "../src/reports/names.ts";
import { reportHtml } from "../src/reports/template.ts";
import { decryptBackup, encryptBackup } from "../src/security/backup.ts";
const NOW = "2026-11-12T15:00:00.000Z";
const guest = (n = 1): GuestInput => ({
  fullName: `نزيل تجريبي محمد ${n}`,
  nationality: "يمني",
  governorate: "تعز",
  city: "القاهرة",
  identityType: "شخصية",
  identityNumber: `0000123${n}`,
  identityIssuer: "تعز",
  identityIssuedOn: "2024-02-29",
});
async function setup(t: { after: (fn: () => void) => void }) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  let clock = NOW;
  const db: Database = {
    exec: async (s) => {
      sql.exec(s);
    },
    run: async (s, ...p) => ({
      changes: Number(sql.prepare(s).run(...p).changes),
    }),
    all: async <T>(s: string, ...p: any[]) =>
      sql
        .prepare(s)
        .all(...p)
        .map((row) => ({ ...row })) as T[],
    first: async <T>(s: string, ...p: any[]) => {
      const row = sql.prepare(s).get(...p);
      return row ? ({ ...row } as T) : null;
    },
  };
  const repo = new Repository(db, randomUUID, () => clock);
  await repo.initialize();
  const room = async (label = "101", capacity = 5) => {
    await repo.saveRoom(label, capacity);
    return (await repo.rooms()).find((r) => r.label === label)!.id;
  };
  const add = async (
    n: number,
    roomId: string,
    checkIn = "2026-11-10T12:00:00.000Z",
  ) => repo.register(guest(n), { roomId, checkIn, notes: "ملاحظات تجريبية" });
  return {
    repo,
    sql,
    db,
    room,
    add,
    setClock: (time: string) => {
      clock = time;
    },
  };
}
test("migration is idempotent and foreign keys remain enabled", async (t) => {
  const { repo, sql } = await setup(t);
  await repo.initialize();
  assert.equal(
    (sql.prepare("PRAGMA foreign_keys").get() as any).foreign_keys,
    1,
  );
  assert.equal(
    (sql.prepare("PRAGMA user_version").get() as any).user_version,
    1,
  );
});
test("every current resident appears, regardless of arrival date", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room();
  await add(1, r, "2025-01-01T10:00:00.000Z");
  await add(2, r, NOW);
  assert.equal((await repo.reportPreview()).entries.length, 2);
});
test("departures are excluded; yesterday snapshots do not change", async (t) => {
  const { repo, room, add } = await setup(t);
  await add(1, await room());
  const p = await repo.reportPreview();
  const report = await repo.issueReport(p.fingerprint);
  await repo.checkout(p.entries[0]!.stayId);
  assert.equal((await repo.residents()).length, 0);
  assert.deepEqual((await repo.report(report.id)).entries, report.entries);
});
test("room transfer shows the current room and preserves old report", async (t) => {
  const { repo, room, add, sql } = await setup(t);
  const r1 = await room(),
    r2 = await room("102");
  await add(1, r1);
  const p = await repo.reportPreview();
  const report = await repo.issueReport(p.fingerprint);
  await repo.move(p.entries[0]!.stayId, r2);
  assert.equal((await repo.residents())[0]!.roomLabel, "102");
  assert.equal((await repo.report(report.id)).entries[0]!.roomLabel, "101");
  assert.equal(
    (sql.prepare("SELECT COUNT(*) n FROM room_history").get() as any).n,
    2,
  );
});
test("returning guest uses one identity and a new stay", async (t) => {
  const { repo, room, add, setClock } = await setup(t);
  const r = await room();
  const guestId = await add(1, r);
  const stay = (await repo.residents())[0]!;
  await repo.checkout(stay.stayId);
  setClock("2026-11-13T12:00:00.000Z");
  await repo.startStay({
    guestId,
    roomId: r,
    checkIn: "2026-11-13T10:00:00.000Z",
    notes: "",
  });
  assert.equal((await repo.guests()).length, 1);
  assert.equal((await repo.history(guestId)).length, 2);
  assert.equal((await repo.residents()).length, 1);
});
test("identity strings retain leading zeros and normalize Arabic digits", async (t) => {
  const { repo, room } = await setup(t);
  await repo.register(
    { ...guest(), identityNumber: "٠٠١٢٣٤٥٦" },
    { roomId: await room(), checkIn: NOW, notes: "" },
  );
  assert.equal((await repo.guests())[0]!.identityNumber, "00123456");
});
test("duplicate identity rejected and failed registration leaves no orphan guest", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room("101", 1);
  await add(1, r);
  await assert.rejects(() => add(1, r));
  await assert.rejects(() => add(2, r));
  assert.equal((await repo.guests()).length, 1);
});
test("simultaneous registrations cannot overbook a room", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room("101", 1);
  const results = await Promise.allSettled([add(1, r), add(2, r)]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await repo.residents()).length, 1);
});
test("cannot open two stays for one guest", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room();
  const id = await add(1, r);
  await assert.rejects(() =>
    repo.startStay({ guestId: id, roomId: r, checkIn: NOW, notes: "" }),
  );
});
test("closed stay cannot be moved or checked out twice", async (t) => {
  const { repo, room, add } = await setup(t);
  await add(1, await room());
  const s = (await repo.residents())[0]!;
  await repo.checkout(s.stayId);
  await assert.rejects(() => repo.checkout(s.stayId));
  await assert.rejects(() => repo.move(s.stayId, "missing"));
});
test("room capacity cannot be reduced below occupancy", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room("101", 2);
  await add(1, r);
  await add(2, r);
  await assert.rejects(() => repo.saveRoom("101", 1, r));
});
test("move into full room rolls back history and room", async (t) => {
  const { repo, room, add, sql } = await setup(t);
  const r1 = await room(),
    r2 = await room("102", 1);
  await add(1, r1);
  await add(2, r2);
  const s = (await repo.residents()).find(
    (g) => g.identityNumber === guest(1).identityNumber,
  )!;
  await assert.rejects(() => repo.move(s.stayId, r2));
  assert.equal((await repo.residents()).find((g) => g.id === s.id)!.roomId, r1);
  assert.equal(
    (
      sql
        .prepare("SELECT COUNT(*) n FROM room_history WHERE stayId=?")
        .get(s.stayId) as any
    ).n,
    1,
  );
});
test("future check-in and overlapping return are rejected", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room();
  await assert.rejects(() => add(1, r, "2027-01-01T00:00:00.000Z"));
  const id = await add(1, r);
  await repo.checkout((await repo.residents())[0]!.stayId);
  await assert.rejects(() =>
    repo.startStay({
      guestId: id,
      roomId: r,
      checkIn: "2026-11-11T10:00:00.000Z",
      notes: "",
    }),
  );
});
test("stale report preview is rejected after a guest edit", async (t) => {
  const { repo, room, add } = await setup(t);
  const id = await add(1, await room());
  const p = await repo.reportPreview();
  await repo.updateGuest(id, { ...guest(), city: "المدينة الجديدة" });
  await assert.rejects(() => repo.issueReport(p.fingerprint));
  assert.equal((await repo.reports()).length, 0);
});
test("stale report preview is rejected after settings change", async (t) => {
  const { repo, room, add } = await setup(t);
  await add(1, await room());
  const p = await repo.reportPreview();
  await repo.saveSettings({ ...DEFAULT_SETTINGS, manager: "مدير تجريبي" });
  await assert.rejects(() => repo.issueReport(p.fingerprint));
});
test("empty report cannot be issued", async (t) => {
  const { repo } = await setup(t);
  await assert.rejects(() => repo.issueReport(""));
});
test("report snapshot survives guest and property edits", async (t) => {
  const { repo, room, add } = await setup(t);
  const id = await add(1, await room());
  const r = await repo.issueReport((await repo.reportPreview()).fingerprint);
  await repo.updateGuest(id, { ...guest(), fullName: "اسم آخر محمد تجريبي" });
  await repo.saveSettings({
    ...DEFAULT_SETTINGS,
    propertyName: "استراحة أخرى",
  });
  assert.deepEqual(await repo.report(r.id), r);
});
test("database rejects direct report mutation and deletion", async (t) => {
  const { repo, room, add, sql } = await setup(t);
  await add(1, await room());
  await repo.issueReport((await repo.reportPreview()).fingerprint);
  assert.throws(() => sql.exec("UPDATE reports SET count=99"));
  assert.throws(() => sql.exec("DELETE FROM reports"));
});
test("SQL payloads remain plain values", async (t) => {
  const { repo, room } = await setup(t);
  await repo.register(
    { ...guest(), city: "x'); DROP TABLE guests;--" },
    { roomId: await room(), checkIn: NOW, notes: "" },
  );
  assert.equal((await repo.guests()).length, 1);
  assert.equal((await repo.guests("x' OR 1=1--")).length, 0);
});
test("invalid identity date is rejected, valid leap day accepted", () => {
  assert.throws(() =>
    validateGuest({ ...guest(), identityIssuedOn: "2025-02-29" }),
  );
  assert.equal(validateGuest(guest()).identityIssuedOn, "2024-02-29");
});
test("Aden local time converts to UTC, malformed dates fail", () => {
  assert.equal(inputToInstant("٢٠٢٦-١١-١٢ ١٨:٠٠"), NOW);
  assert.throws(() => inputToInstant("2026-02-30 12:00"));
  assert.throws(() => inputToInstant("2026-11-12 24:30"));
});
test("HTML escapes guest fields, property fields and notes", async (t) => {
  const { repo, room } = await setup(t);
  await repo.register(
    { ...guest(), fullName: "<script> تجريبي محمد أحمد" },
    {
      roomId: await room(),
      checkIn: NOW,
      notes: "<img src=x onerror=alert(1)>",
    },
  );
  const report = await repo.issueReport(
    (await repo.reportPreview()).fingerprint,
  );
  const html = reportHtml(report);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
});
test("pagination includes every resident exactly once", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room("101", 30);
  for (let i = 1; i <= 26; i++) await add(i, r);
  const report = await repo.issueReport(
    (await repo.reportPreview()).fingerprint,
  );
  const html = reportHtml(report);
  assert.ok((html.match(/class="sheet"/g) ?? []).length >= 3);
  for (const g of report.entries)
    assert.equal(html.split(`<td>${g.fullName}</td>`).length - 1, 1);
});
test("encrypted backup round trip restores every table and archived report", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  const r = await a.room();
  await a.add(1, r);
  const report = await a.repo.issueReport(
    (await a.repo.reportPreview()).fingerprint,
  );
  const original = await a.repo.exportData();
  const cipher = await encryptBackup(
    original,
    "a strong password 123",
    randomBytes,
  );
  assert.ok(!cipher.includes(guest().fullName));
  const plain = await decryptBackup(cipher, "a strong password 123");
  await b.repo.restoreData(plain);
  assert.deepEqual(await b.repo.report(report.id), report);
  assert.equal((await b.repo.residents()).length, 1);
});
test("wrong password and tampering fail closed", async (t) => {
  const { repo } = await setup(t);
  const cipher = await encryptBackup(
    await repo.exportData(),
    "a strong password 123",
    randomBytes,
  );
  await assert.rejects(() => decryptBackup(cipher, "wrong password 123"));
  const payload = JSON.parse(cipher);
  payload.data = (payload.data[0] === "0" ? "1" : "0") + payload.data.slice(1);
  await assert.rejects(() =>
    decryptBackup(JSON.stringify(payload), "a strong password 123"),
  );
});
test("restore never overwrites existing records", async (t) => {
  const { repo, room } = await setup(t);
  const empty = await repo.exportData();
  await room();
  await assert.rejects(() => repo.restoreData(empty));
  assert.equal((await repo.rooms()).length, 1);
});
test("invalid backup foreign keys roll back the entire restore", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  await a.add(1, await a.room());
  const data = await a.repo.exportData();
  data.stays[0]!.roomId = "missing-room";
  await assert.rejects(() => b.repo.restoreData(data));
  assert.equal((await b.repo.guests()).length, 0);
  assert.equal((await b.repo.rooms()).length, 0);
});
test("notes can be corrected without changing an issued report", async (t) => {
  const { repo, room, add } = await setup(t);
  await add(1, await room());
  const p = await repo.reportPreview();
  const report = await repo.issueReport(p.fingerprint);
  await repo.updateStayNotes(p.entries[0]!.stayId, "ملاحظة جديدة");
  assert.equal((await repo.residents())[0]!.notes, "ملاحظة جديدة");
  assert.equal(
    (await repo.report(report.id)).entries[0]!.notes,
    "ملاحظات تجريبية",
  );
  await assert.rejects(() => repo.issueReport(p.fingerprint));
});
test("long report notes remain complete in a full-width detail row", async (t) => {
  const { repo, room } = await setup(t);
  const notes = "ملاحظة طويلة للاختبار ".repeat(40);
  await repo.register(guest(), { roomId: await room(), checkIn: NOW, notes });
  const report = await repo.issueReport(
    (await repo.reportPreview()).fingerprint,
  );
  const html = reportHtml(report);
  assert.ok(html.includes('colspan="14"'));
  assert.ok(html.includes(notes.trim()));
});
test("noncanonical or impossible UTC timestamps are rejected", async (t) => {
  const { repo, room, add } = await setup(t);
  const r = await room();
  await assert.rejects(() => add(1, r, "2026-02-30T00:00:00.000Z"));
  await assert.rejects(() => add(1, r, "2026-11-12T15:00:00Z"));
});

test("batch rooms apply the capacity and natural numeric ordering", async (t) => {
  const { repo } = await setup(t);
  assert.equal(await repo.addRoomRange(8, 12, 3), 5);
  const rooms = await repo.rooms();
  assert.deepEqual(
    rooms.map((r) => r.label),
    ["8", "9", "10", "11", "12"],
  );
  assert.ok(rooms.every((r) => r.capacity === 3));
});
test("a duplicate in the middle of a room batch rolls back prior inserts", async (t) => {
  const { repo, room } = await setup(t);
  await room("102");
  await assert.rejects(() => repo.addRoomRange(101, 104, 2));
  assert.deepEqual(
    (await repo.rooms()).map((r) => r.label),
    ["102"],
  );
});
test("room labels normalize Arabic digits and prevent duplicate labels", async (t) => {
  const { repo } = await setup(t);
  await repo.saveRoom("١٠١", 2);
  await assert.rejects(() => repo.saveRoom("101", 1));
  assert.equal((await repo.rooms())[0]!.label, "101");
});
test("invalid room ranges are rejected without partial writes", async (t) => {
  const { repo } = await setup(t);
  for (const range of [
    [9, 8],
    [1, 201],
    [-1, 2],
    [1.1, 3],
  ])
    await assert.rejects(() => repo.addRoomRange(range[0]!, range[1]!, 2));
  assert.equal((await repo.rooms()).length, 0);
});
test("only unused rooms can be deleted, including after a transfer", async (t) => {
  const { repo, room, add } = await setup(t);
  const a = await room("101"),
    b = await room("102"),
    empty = await room("103");
  await add(1, a);
  await repo.move((await repo.residents())[0]!.stayId, b);
  await assert.rejects(() => repo.deleteUnusedRoom(a));
  await assert.rejects(() => repo.deleteUnusedRoom(b));
  await repo.deleteUnusedRoom(empty);
  assert.equal((await repo.rooms()).length, 2);
});
test("room history shows every segment and keeps equal-time transfers ordered", async (t) => {
  const { repo, room, add } = await setup(t);
  const a = await room("101"),
    b = await room("102"),
    c = await room("103");
  const id = await add(1, a);
  const stay = (await repo.residents())[0]!;
  await repo.move(stay.stayId, b);
  await repo.move(stay.stayId, c);
  await repo.checkout(stay.stayId);
  const h = await repo.roomHistory(id);
  assert.deepEqual(
    h.map((x) => x.roomLabel),
    ["101", "102", "103"],
  );
  assert.equal(h[0]!.endedAt, h[1]!.startedAt);
  assert.equal(h[2]!.endedAt, NOW);
  const other = await setup(t);
  await other.repo.restoreData(await repo.exportData());
  assert.deepEqual(
    (await other.repo.roomHistory(id)).map((x) => x.roomLabel),
    ["101", "102", "103"],
  );
});
test("daily activity uses Yemen midnight and counts completed same-day stays", async (t) => {
  const { repo, room, add, setClock } = await setup(t);
  const r = await room();
  await add(1, r, "2026-11-11T20:59:59.000Z");
  await add(2, r, "2026-11-11T21:00:00.000Z");
  await repo.checkout(
    (await repo.residents()).find(
      (g) => g.identityNumber === guest(2).identityNumber,
    )!.stayId,
  );
  assert.deepEqual(await repo.dailyActivity(NOW), {
    arrivals: 1,
    departures: 1,
  });
  setClock("2026-11-12T21:00:00.000Z");
  assert.deepEqual(await repo.dailyActivity(), { arrivals: 0, departures: 0 });
});
test("report periods follow Yemen dates and the inclusive seven-day calendar window", () => {
  assert.equal(dateKey("2026-11-12T21:01:00.000Z"), "2026-11-13");
  assert.ok(
    isInReportPeriod(
      "2026-11-12T22:00:00.000Z",
      "today",
      "2026-11-13T10:00:00.000Z",
    ),
  );
  assert.ok(
    isInReportPeriod(
      "2026-11-06T21:00:00.000Z",
      "week",
      "2026-11-13T10:00:00.000Z",
    ),
  );
  assert.ok(
    !isInReportPeriod(
      "2026-11-06T20:59:59.000Z",
      "week",
      "2026-11-13T10:00:00.000Z",
    ),
  );
});
test("Arabic search ignores diacritics, hamza and numeral script without rewriting stored names", async (t) => {
  const { repo, room } = await setup(t);
  const name = "أَحمد مُحمد علي صالح";
  await repo.register(
    { ...guest(), fullName: name },
    { roomId: await room(), checkIn: NOW, notes: "" },
  );
  assert.equal((await repo.guests("احمد محمد"))[0]!.fullName, name);
  assert.equal((await repo.guests("٠٠٠٠١٢٣١")).length, 1);
  assert.ok(matchesSearch(["مصطفى"], "مصطفي"));
});
test("control whitespace does not join the four parts of a guest name", () => {
  const result = validateGuest({
    ...guest(),
    fullName: "أحمد\nمحمد\tعلي صالح",
  });
  assert.equal(result.fullName, "أحمد محمد علي صالح");
});
test("restoring a closed stay without its room history is rejected atomically", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  await a.add(1, await a.room());
  await a.repo.checkout((await a.repo.residents())[0]!.stayId);
  const data = await a.repo.exportData();
  data.history = [];
  await assert.rejects(() => b.repo.restoreData(data));
  assert.equal((await b.repo.guests()).length, 0);
});
test("overlapping historical stays are rejected during restore", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  const r = await a.room(),
    id = await a.add(1, r);
  await a.repo.checkout((await a.repo.residents())[0]!.stayId);
  a.setClock("2026-11-13T12:00:00.000Z");
  await a.repo.startStay({
    guestId: id,
    roomId: r,
    checkIn: "2026-11-13T10:00:00.000Z",
    notes: "",
  });
  const data = await a.repo.exportData();
  data.stays[1]!.checkIn = "2026-11-11T12:00:00.000Z";
  data.history[1]!.startedAt = data.stays[1]!.checkIn;
  await assert.rejects(() => b.repo.restoreData(data));
  assert.equal((await b.repo.rooms()).length, 0);
});
test("gaps in room history are rejected during restore", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  const r = await a.room(),
    other = await a.room("102");
  await a.add(1, r);
  await a.repo.move((await a.repo.residents())[0]!.stayId, other);
  const data = await a.repo.exportData();
  data.history[0]!.endedAt = "2026-11-11T12:00:00.000Z";
  await assert.rejects(() => b.repo.restoreData(data));
  assert.equal((await b.repo.residents()).length, 0);
});
test("a rolled-back phone clock cannot create a negative transfer or departure interval", async (t) => {
  const { repo, room, add, setClock } = await setup(t);
  const r = await room(),
    other = await room("102");
  await add(1, r);
  const stay = (await repo.residents())[0]!;
  await repo.move(stay.stayId, other);
  setClock("2026-11-12T14:00:00.000Z");
  await assert.rejects(() => repo.checkout(stay.stayId), /ساعة الهاتف/);
  await assert.rejects(() => repo.move(stay.stayId, r), /ساعة الهاتف/);
  assert.equal((await repo.residents())[0]!.roomId, other);
});
test("PDF filenames contain the local issue date and cannot contain path traversal", async (t) => {
  const { repo, room, add } = await setup(t);
  await add(1, await room());
  const report = await repo.issueReport(
    (await repo.reportPreview()).fingerprint,
  );
  report.id = "../../bad:report";
  const filename = reportFileName(report);
  assert.match(filename, /^nuzul-2026-11-12-180000-[A-Za-z0-9-]+\.pdf$/);
  assert.ok(!filename.includes(".."));
});

test("long archived stay notes do not become guest-identity validation fields during restore", async (t) => {
  const a = await setup(t),
    b = await setup(t);
  await a.repo.register(guest(), {
    roomId: await a.room(),
    checkIn: NOW,
    notes: "ملاحظات إقامة طويلة ".repeat(35),
  });
  const report = await a.repo.issueReport(
    (await a.repo.reportPreview()).fingerprint,
  );
  await b.repo.restoreData(await a.repo.exportData());
  assert.deepEqual(await b.repo.report(report.id), report);
});
test("report issuance rejects a clock older than the latest active room movement", async (t) => {
  const { repo, room, add, setClock } = await setup(t);
  const r = await room(),
    other = await room("102");
  await add(1, r);
  await repo.move((await repo.residents())[0]!.stayId, other);
  setClock("2026-11-12T14:00:00.000Z");
  await assert.rejects(
    () => repo.issueReport("unused-fingerprint"),
    /ساعة الهاتف/,
  );
  assert.equal((await repo.reports()).length, 0);
});
