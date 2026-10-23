-- Bổ sung bảng Web Push cho DB ĐÃ CÓ DỮ LIỆU (không xoá gì).
-- DB mới tạo bằng schema.sql thì KHÔNG cần chạy file này.
--   psql "$DATABASE_URL" -f db/migrations/001_web_push.sql
BEGIN;
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  user_agent varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_push_user ON web_push_subscriptions(user_id);
DROP TRIGGER IF EXISTS trg_web_push_updated ON web_push_subscriptions;
CREATE TRIGGER trg_web_push_updated BEFORE UPDATE ON web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
COMMIT;
