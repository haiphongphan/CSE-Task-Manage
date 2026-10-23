-- =====================================================================
-- CSE Task Manage — Lược đồ cơ sở dữ liệu (PostgreSQL 16)
-- ---------------------------------------------------------------------
-- File này là "nguồn sự thật" (source of truth) của DB.
-- Prisma ở apps/api đọc lại cấu trúc này bằng `prisma db pull`.
--
-- Chạy:  psql -d cse_task_manage -f db/schema.sql
-- Chạy lại nhiều lần được: mọi thứ bị DROP rồi tạo lại từ đầu
-- (=> MẤT DỮ LIỆU, chỉ dùng khi phát triển).
-- =====================================================================

-- Ẩn các NOTICE kiểu "table ... does not exist, skipping"
SET client_min_messages = warning;

BEGIN;

-- pgcrypto: cung cấp crypt()/gen_salt() để băm mật khẩu bằng bcrypt ngay trong SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Dọn dẹp (thứ tự ngược với phụ thuộc) ----------
DROP TABLE IF EXISTS activity_logs   CASCADE;
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS web_push_subscriptions CASCADE;
DROP TABLE IF EXISTS push_tokens     CASCADE;
DROP TABLE IF EXISTS tasks           CASCADE;
DROP TABLE IF EXISTS event_members   CASCADE;
DROP TABLE IF EXISTS events          CASCADE;
DROP TABLE IF EXISTS users           CASCADE;
DROP SEQUENCE IF EXISTS task_code_seq;
DROP TYPE IF EXISTS user_role, event_status, task_type, task_status, notification_type CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS check_event_member_is_btt() CASCADE;

-- ---------- Kiểu liệt kê (ENUM) ----------
-- Vai trò: ADMIN quản trị, BCH = Ban chấp hành (tạo sự kiện), BTT = Ban truyền thông (làm task)
CREATE TYPE user_role AS ENUM ('ADMIN', 'BCH', 'BTT');

-- Trạng thái sự kiện. "Đang diễn ra / Quá hạn" KHÔNG lưu mà tính từ thời gian.
CREATE TYPE event_status AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED');

-- Loại task: 6 loại ấn phẩm media + chụp ảnh + recap sau sự kiện
CREATE TYPE task_type AS ENUM (
  'BANNER', 'BACKDROP', 'BANDROLL', 'STANDEE', 'INVITATION_LETTER', 'OTHER',
  'PHOTOGRAPHER', 'RECAP'
);

CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED');

CREATE TYPE notification_type AS ENUM (
  'DAILY_DIGEST',    -- tự động 09:00 mỗi ngày: gộp mọi task còn mở (push + email)
  'MANUAL_REMIND',   -- BCH bấm "Nhắc" một task
  'EVENT_ASSIGNED',  -- BTT được phân công vào sự kiện
  'TASK_UPDATED'     -- task/sự kiện được chỉnh sửa hoặc hoàn thành
);

-- ---------- Hàm dùng chung: tự cập nhật cột updated_at ----------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- users: tài khoản
-- =====================================================================
CREATE TABLE users (
  id                   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name            varchar(100) NOT NULL,
  username             varchar(50)  NOT NULL UNIQUE,
  email                varchar(255) NOT NULL UNIQUE,
  password_hash        text         NOT NULL,            -- bcrypt, KHÔNG BAO GIỜ lưu mật khẩu thô
  role                 user_role    NOT NULL,
  must_change_password boolean      NOT NULL DEFAULT false, -- true khi admin tạo với mật khẩu tạm
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9._]{3,50}$'),
  CONSTRAINT users_email_format    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- events: sự kiện do BCH tạo
-- =====================================================================
CREATE TABLE events (
  id                    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                  varchar(150) NOT NULL,
  location              varchar(150) NOT NULL,
  starts_at             timestamptz  NOT NULL,
  ends_at               timestamptz  NOT NULL,
  notes                 text,          -- Ghi chú chi tiết / thông tin recap
  online_content        text,          -- Nội dung ấn phẩm online
  offline_content       text,          -- Nội dung ấn phẩm in ấn
  photographer_needed   boolean      NOT NULL DEFAULT true,
  photographer_quantity smallint     NOT NULL DEFAULT 1,
  status                event_status NOT NULL DEFAULT 'DRAFT',
  created_by            integer      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at          timestamptz,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at >= starts_at),
  CONSTRAINT events_photo_qty  CHECK (photographer_quantity BETWEEN 0 AND 20)
);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_starts_at  ON events(starts_at);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- event_members: các BTT phụ trách một sự kiện (quan hệ nhiều–nhiều)
-- Task KHÔNG giao cho từng người: cả nhóm BTT của sự kiện cùng phụ trách
-- mọi task của sự kiện đó.
-- =====================================================================
CREATE TABLE event_members (
  event_id   integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    integer     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX idx_event_members_user ON event_members(user_id);

-- CHECK không tham chiếu được bảng khác, nên dùng trigger để bảo đảm
-- chỉ tài khoản role BTT mới được thêm vào event_members.
CREATE FUNCTION check_event_member_is_btt() RETURNS trigger AS $$
BEGIN
  IF (SELECT role FROM users WHERE id = NEW.user_id) <> 'BTT' THEN
    RAISE EXCEPTION 'Chỉ tài khoản BTT mới được phân công vào sự kiện (user_id=%)', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_event_members_btt BEFORE INSERT OR UPDATE ON event_members
  FOR EACH ROW EXECUTE FUNCTION check_event_member_is_btt();

-- =====================================================================
-- tasks: công việc trong sự kiện
-- =====================================================================
CREATE SEQUENCE task_code_seq START 1;

CREATE TABLE tasks (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         varchar(20)  NOT NULL UNIQUE
               DEFAULT ('TSK-' || lpad(nextval('task_code_seq')::text, 3, '0')),
  event_id     integer      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type         task_type    NOT NULL,
  title        varchar(150) NOT NULL,     -- VD "Banner", hoặc loại tự đặt khi type = OTHER
  dimensions   varchar(100),              -- VD "1920 × 1080 px"
  deadline     timestamptz  NOT NULL,
  status       task_status  NOT NULL DEFAULT 'TODO',
  progress     smallint     NOT NULL DEFAULT 0,
  notes        text,
  completed_at timestamptz,
  completed_by integer      REFERENCES users(id) ON DELETE SET NULL, -- ai bấm hoàn thành
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT tasks_progress_range CHECK (progress BETWEEN 0 AND 100),
  -- Task đã hoàn thành phải có completed_at và ngược lại
  CONSTRAINT tasks_completed_consistency
    CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_tasks_event    ON tasks(event_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline) WHERE status <> 'COMPLETED';
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- push_tokens: token thông báo đẩy của từng thiết bị (Expo Push Token)
-- Một user có thể đăng nhập nhiều điện thoại => nhiều token.
-- =====================================================================
CREATE TABLE push_tokens (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      varchar(255) NOT NULL UNIQUE,   -- VD "ExponentPushToken[xxxx]"
  platform   varchar(20)  NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE TRIGGER trg_push_tokens_updated BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- web_push_subscriptions: đăng ký Web Push của trình duyệt / web app đã
-- "Thêm vào màn hình chính" trên iPhone (iOS 16.4+), Android, máy tính.
-- Trình duyệt cấp 3 giá trị: endpoint (URL của dịch vụ push: Apple/Google/
-- Mozilla) + 2 khoá p256dh, auth để mã hoá nội dung gửi tới đúng máy đó.
-- =====================================================================
CREATE TABLE web_push_subscriptions (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  user_agent varchar(300),            -- để biết là iPhone hay máy tính (hiển thị/gỡ lỗi)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_web_push_user ON web_push_subscriptions(user_id);
CREATE TRIGGER trg_web_push_updated BEFORE UPDATE ON web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- notifications: hộp thư thông báo trong app (cũng là nhật ký đã gửi push)
-- =====================================================================
CREATE TABLE notifications (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id  integer           NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id      integer           REFERENCES events(id) ON DELETE CASCADE,
  task_id       integer           REFERENCES tasks(id)  ON DELETE CASCADE,
  type          notification_type NOT NULL,
  title         varchar(200)      NOT NULL,
  body          text              NOT NULL,
  sent_by       integer           REFERENCES users(id) ON DELETE SET NULL, -- NULL = hệ thống tự gửi
  reminder_date date,             -- ngày (giờ VN) của bản tin hằng ngày, chống gửi trùng
  push_sent_at  timestamptz,      -- thời điểm đã đẩy sang dịch vụ push (NULL = chưa/không đẩy)
  email_sent_at timestamptz,      -- thời điểm đã gửi email (NULL = chưa/không gửi)
  read_at       timestamptz,
  dismissed_at  timestamptz,      -- người dùng bấm "Đã hiểu"
  created_at    timestamptz       NOT NULL DEFAULT now()
);
-- Mỗi người nhận + loại + ngày chỉ có 1 bản tin (VD: 1 DAILY_DIGEST / người / ngày).
-- NULLS NOT DISTINCT (PostgreSQL 15+): coi task_id NULL như nhau, nếu không
-- Postgres sẽ coi mọi NULL là khác nhau và chỉ mục mất tác dụng.
-- Thông báo thủ công có reminder_date NULL nên không bị ràng buộc này.
CREATE UNIQUE INDEX uq_notifications_daily
  ON notifications(task_id, recipient_id, type, reminder_date) NULLS NOT DISTINCT
  WHERE reminder_date IS NOT NULL;
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);

-- =====================================================================
-- activity_logs: "Hoạt động gần đây" của một sự kiện
-- =====================================================================
CREATE TABLE activity_logs (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id   integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_id   integer     REFERENCES users(id) ON DELETE SET NULL,
  message    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_event ON activity_logs(event_id, created_at DESC);

-- =====================================================================
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------
-- Supabase tự mở schema "public" ra REST API công khai (khoá anon).
-- Bật RLS mà KHÔNG tạo policy nào => khoá anon không đọc/ghi được gì.
-- API của chúng ta kết nối bằng user sở hữu bảng (postgres) nên không bị ảnh hưởng.
-- Chạy local cũng an toàn: chủ sở hữu bảng bỏ qua RLS.
-- =====================================================================
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs  ENABLE ROW LEVEL SECURITY;

COMMIT;
