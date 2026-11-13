export const SCHEMA = `
CREATE TABLE IF NOT EXISTS guests (
 id TEXT PRIMARY KEY, fullName TEXT NOT NULL, nationality TEXT NOT NULL,
 governorate TEXT NOT NULL, city TEXT NOT NULL, identityType TEXT NOT NULL,
 identityNumber TEXT NOT NULL DEFAULT '', identityIssuer TEXT NOT NULL DEFAULT '',
 identityIssuedOn TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS guest_identity ON guests(identityType,identityNumber) WHERE identityNumber <> '';
CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, label TEXT UNIQUE NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 500));
CREATE TABLE IF NOT EXISTS stays (
 id TEXT PRIMARY KEY, guestId TEXT NOT NULL REFERENCES guests(id), roomId TEXT NOT NULL REFERENCES rooms(id),
 checkIn TEXT NOT NULL, checkOut TEXT, notes TEXT NOT NULL DEFAULT '', CHECK(checkOut IS NULL OR checkOut >= checkIn)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_stay ON stays(guestId) WHERE checkOut IS NULL;
CREATE INDEX IF NOT EXISTS stay_room ON stays(roomId,checkOut);
CREATE TABLE IF NOT EXISTS room_history (
 id TEXT PRIMARY KEY, stayId TEXT NOT NULL REFERENCES stays(id), roomId TEXT NOT NULL REFERENCES rooms(id),
 startedAt TEXT NOT NULL, endedAt TEXT, CHECK(endedAt IS NULL OR endedAt >= startedAt)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_room ON room_history(stayId) WHERE endedAt IS NULL;
CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, issuedAt TEXT NOT NULL, count INTEGER NOT NULL, snapshot TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS report_date ON reports(issuedAt DESC);
CREATE TRIGGER IF NOT EXISTS immutable_reports_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT,'Reports are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_reports_delete BEFORE DELETE ON reports BEGIN SELECT RAISE(ABORT,'Reports are immutable'); END;
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
PRAGMA user_version = 1;
`;
