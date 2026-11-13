import type { BackupData } from "./backup.ts";
import type { Report } from "../domain/types.ts";
import {
  UserError,
  validateGuest,
  validateSettings,
} from "../domain/validation.ts";

/** Validate the complete timeline before any backup row is committed. O(n log n). */
export function validateBackupIntegrity(data: BackupData) {
  const fail = () => {
    throw new UserError("سجلات الإقامة أو حركة الغرف في النسخة غير متسقة.");
  };
  validateSettings(data.settings);
  const guests = new Map(data.guests.map((g) => [g.id, g]));
  const rooms = new Map(data.rooms.map((r) => [r.id, r]));
  const stays = new Map(data.stays.map((s) => [s.id, s]));
  if (
    guests.size !== data.guests.length ||
    rooms.size !== data.rooms.length ||
    stays.size !== data.stays.length
  )
    fail();
  for (const g of data.guests) validateGuest(g);
  const byGuest = new Map<string, BackupData["stays"]>();
  const byStay = new Map<string, BackupData["history"]>();
  const occupancy = new Map<string, number>();
  for (const s of data.stays) {
    if (
      !guests.has(s.guestId) ||
      !rooms.has(s.roomId) ||
      (s.checkOut !== null && s.checkOut < s.checkIn)
    )
      fail();
    const list = byGuest.get(s.guestId) ?? [];
    list.push(s);
    byGuest.set(s.guestId, list);
    if (s.checkOut === null)
      occupancy.set(s.roomId, (occupancy.get(s.roomId) ?? 0) + 1);
  }
  for (const [id, count] of occupancy)
    if (count > rooms.get(id)!.capacity) fail();
  for (const list of byGuest.values()) {
    list.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    for (let i = 1; i < list.length; i++) {
      const previous = list[i - 1]!,
        next = list[i]!;
      if (previous.checkOut === null || previous.checkOut > next.checkIn)
        fail();
    }
  }
  for (const h of data.history) {
    if (
      !stays.has(h.stayId) ||
      !rooms.has(h.roomId) ||
      (h.endedAt !== null && h.endedAt < h.startedAt)
    )
      fail();
    const list = byStay.get(h.stayId) ?? [];
    list.push(h);
    byStay.set(h.stayId, list);
  }
  for (const s of data.stays) {
    // Equal-time moves retain their insertion order in the exported history array.
    const list = (byStay.get(s.id) ?? []).sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    );
    if (!list.length) fail();
    const first = list[0]!,
      last = list[list.length - 1]!;
    if (
      first.startedAt !== s.checkIn ||
      last.endedAt !== s.checkOut ||
      last.roomId !== s.roomId
    )
      fail();
    for (let i = 1; i < list.length; i++)
      if (list[i - 1]!.endedAt !== list[i]!.startedAt) fail();
  }
  for (const r of data.reports) {
    const report = JSON.parse(r.snapshot) as Report;
    validateSettings(report.settings);
    if (
      report.id !== r.id ||
      report.issuedAt !== r.issuedAt ||
      report.entries.length !== r.count ||
      new Set(report.entries.map((e) => e.stayId)).size !== r.count ||
      new Set(report.entries.map((e) => e.id)).size !== r.count
    )
      fail();
    for (const e of report.entries) {
      validateGuest(e);
      if (e.checkIn > report.issuedAt) fail();
    }
  }
}
