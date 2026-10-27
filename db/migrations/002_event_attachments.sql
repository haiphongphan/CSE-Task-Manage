-- Bổ sung bảng file mẫu/tham chiếu cho DB ĐÃ CÓ DỮ LIỆU (không xoá gì).
-- DB mới tạo bằng schema.sql thì KHÔNG cần chạy file này.
--   psql "$DATABASE_URL" -f db/migrations/002_event_attachments.sql
BEGIN;
CREATE TABLE IF NOT EXISTS event_attachments (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    integer      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file_name   varchar(255) NOT NULL,
  mime_type   varchar(100) NOT NULL,
  size_bytes  integer      NOT NULL CHECK (size_bytes > 0),
  data        bytea        NOT NULL,
  uploaded_by integer      REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_attachments_event ON event_attachments(event_id);
ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;
COMMIT;
