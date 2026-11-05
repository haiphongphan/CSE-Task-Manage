-- Sự kiện nhiều ngày + lịch chụp ảnh theo ngày, cho DB ĐÃ CÓ DỮ LIỆU (không xoá gì).
-- DB mới tạo bằng schema.sql thì KHÔNG cần chạy file này.
--   psql "$DATABASE_URL" -f db/migrations/003_event_sessions.sql
-- Sự kiện cũ: tạo 1 buổi = (starts_at, ends_at); nếu cần chụp ảnh thì
-- tạo 1 slot chụp cùng giờ với số người = photographer_quantity.
BEGIN;

CREATE TABLE IF NOT EXISTS event_sessions (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id  integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  CONSTRAINT event_sessions_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions(event_id, starts_at);

CREATE TABLE IF NOT EXISTS photo_slots (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id  integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  quantity  smallint    NOT NULL DEFAULT 1,
  CONSTRAINT photo_slots_time_order CHECK (ends_at > starts_at),
  CONSTRAINT photo_slots_quantity   CHECK (quantity BETWEEN 1 AND 20)
);
CREATE INDEX IF NOT EXISTS idx_photo_slots_event ON photo_slots(event_id, starts_at);

ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_slots    ENABLE ROW LEVEL SECURITY;

-- Chuyển dữ liệu cũ (chạy lại nhiều lần cũng không tạo trùng)
INSERT INTO event_sessions (event_id, starts_at, ends_at)
SELECT e.id, e.starts_at, GREATEST(e.ends_at, e.starts_at + interval '1 minute')
FROM events e
WHERE NOT EXISTS (SELECT 1 FROM event_sessions s WHERE s.event_id = e.id);

INSERT INTO photo_slots (event_id, starts_at, ends_at, quantity)
SELECT e.id, e.starts_at, GREATEST(e.ends_at, e.starts_at + interval '1 minute'), GREATEST(e.photographer_quantity, 1)
FROM events e
WHERE e.photographer_needed
  AND NOT EXISTS (SELECT 1 FROM photo_slots p WHERE p.event_id = e.id);

COMMIT;
