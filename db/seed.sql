-- =====================================================================
-- CSE Task Manage — Dữ liệu mẫu
-- ---------------------------------------------------------------------
-- PHẢI chạy từ trong thư mục db/ vì \copy đọc đường dẫn tương đối:
--   cd db && psql -d cse_task_manage -f seed.sql
--
-- Ngày giờ sự kiện được tính TƯƠNG ĐỐI so với hôm nay (CURRENT_DATE),
-- nên lúc nào nạp lại cũng có đủ tình huống để demo:
--   * sự kiện sắp diễn ra trong 3 ngày  -> có nhắc "Phân công chụp ảnh"
--   * sự kiện vừa kết thúc              -> có nhắc "Recap sự kiện"
--   * bản nháp, sự kiện đã hoàn thành ...
-- Mật khẩu mọi tài khoản mẫu: matkhau123
-- =====================================================================

BEGIN;

-- Xoá dữ liệu cũ, đưa bộ đếm ID về 1
TRUNCATE activity_logs, notifications, push_tokens, tasks, event_members, events, users
  RESTART IDENTITY CASCADE;
ALTER SEQUENCE task_code_seq RESTART WITH 1;

-- ---------------------------------------------------------------------
-- 1) Nạp tài khoản từ CSV qua bảng tạm, rồi băm mật khẩu bằng bcrypt
-- ---------------------------------------------------------------------
CREATE TEMP TABLE staging_users (
  full_name text, username text, email text, role text, password text
) ON COMMIT DROP;

\copy staging_users FROM 'data/users.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

INSERT INTO users (full_name, username, email, role, password_hash)
SELECT full_name, username, email, role::user_role,
       crypt(password, gen_salt('bf', 10))   -- bcrypt, cost 10 (bcryptjs đọc được)
FROM staging_users;

-- ---------------------------------------------------------------------
-- Hàm tạm (chỉ sống trong phiên psql này) cho dễ đọc
-- ---------------------------------------------------------------------
-- uid('mai.anh')  -> id của user
CREATE FUNCTION pg_temp.uid(p_username text) RETURNS integer AS $$
  SELECT id FROM users WHERE username = p_username
$$ LANGUAGE sql STABLE;

-- vn(3, '09:00') -> 09:00 giờ Việt Nam của ngày (hôm nay + 3)
CREATE FUNCTION pg_temp.vn(p_days integer, p_time time) RETURNS timestamptz AS $$
  SELECT ((CURRENT_DATE + p_days) + p_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- 2) Sự kiện
-- ---------------------------------------------------------------------
INSERT INTO events (name, location, starts_at, ends_at, notes, online_content, offline_content,
                    photographer_needed, photographer_quantity, status, created_by, published_at)
VALUES
-- (1) Sắp diễn ra trong 3 ngày
('Ngày hội Sáng tạo CSE', 'Hội trường A, Tòa nhà CSE',
  pg_temp.vn(3, '09:00'), pg_temp.vn(3, '16:00'),
  'Ngày hội trưng bày dự án sinh viên, demo và chia sẻ từ cựu sinh viên. Ghi hình khai mạc, các gian dự án, diễn giả và ảnh tập thể. Recap: nêu bật 12 dự án, 3 diễn giả khách mời và các giải thưởng. Chia sẻ ảnh đã chỉnh trong 24 giờ sau sự kiện.',
  'Ngày hội Sáng tạo CSE 2026 — Kết nối. Kiến tạo. Truyền cảm hứng. Hẹn bạn tại Hội trường A để khám phá các dự án sáng tạo của sinh viên và gặp gỡ các mentor. Đăng ký: cse.edu.vn/sangtao #CSEInnovationDay',
  E'NGÀY HỘI SÁNG TẠO CSE 2026\nKẾT NỐI. KIẾN TẠO. TRUYỀN CẢM HỨNG.\nHội trường A, Tòa nhà CSE\nCó logo CSE, logo đối tác và mã QR đăng ký. Chừa lề an toàn 5 cm cho bản in khổ lớn.',
  true, 1, 'PUBLISHED', pg_temp.uid('mai.anh'), now() - interval '5 days'),

-- (2) Diễn ra sau 8 ngày, không cần chụp ảnh
('Tọa đàm Công nghệ Cộng đồng', 'Phòng Lab 2',
  pg_temp.vn(8, '14:00'), pg_temp.vn(8, '16:00'),
  'Tọa đàm về xu hướng AI và phát triển phần mềm. Recap: trích dẫn hay từ diễn giả và số người tham dự.',
  'Tọa đàm Công nghệ Cộng đồng — AI có thay thế lập trình viên? Đăng ký miễn phí tại cse.edu.vn/toadam',
  E'TỌA ĐÀM CÔNG NGHỆ CỘNG ĐỒNG\nPhòng Lab 2 · 14:00–16:00',
  false, 0, 'PUBLISHED', pg_temp.uid('mai.anh'), now() - interval '3 days'),

-- (3) Đã kết thúc 4 ngày trước, recap còn thiếu
('Gặp mặt Tân sinh viên CSE', 'Sân trung tâm',
  pg_temp.vn(-4, '16:00'), pg_temp.vn(-4, '18:00'),
  'Buổi gặp mặt chào đón tân sinh viên K26. Recap: album ảnh và video highlight.',
  'Chào mừng K26 đến với CSE! Gặp nhau tại Sân trung tâm nhé.',
  E'CHÀO MỪNG TÂN SINH VIÊN K26\nSân trung tâm',
  true, 2, 'PUBLISHED', pg_temp.uid('mai.anh'), now() - interval '14 days'),

-- (4) Bản nháp, chưa phân công
('Đêm Kết nối Cựu sinh viên', 'Hội trường CSE',
  pg_temp.vn(16, '18:00'), pg_temp.vn(16, '20:00'),
  'Đêm giao lưu giữa cựu sinh viên và sinh viên năm cuối.', NULL, NULL,
  true, 1, 'DRAFT', pg_temp.uid('mai.anh'), NULL),

-- (5) Đã hoàn thành
('CSE Design Sprint', 'Phòng Innovation Lab',
  pg_temp.vn(-13, '08:30'), pg_temp.vn(-13, '17:00'),
  'Một ngày thiết kế sản phẩm theo phương pháp Design Sprint.', 'Design Sprint đã sẵn sàng!', 'CSE DESIGN SPRINT',
  true, 1, 'COMPLETED', pg_temp.uid('mai.anh'), now() - interval '25 days'),

-- (6) Của BCH khác
('Workshop Git cơ bản', 'Phòng H6-301',
  pg_temp.vn(20, '18:00'), pg_temp.vn(20, '20:30'),
  'Workshop nhập môn Git & GitHub cho sinh viên năm nhất.', 'Học Git trong 2 giờ — đăng ký ngay!', 'WORKSHOP GIT CƠ BẢN',
  true, 1, 'PUBLISHED', pg_temp.uid('thu.pham'), now() - interval '1 day');

-- ---------------------------------------------------------------------
-- 3) Phân công BTT vào sự kiện
-- ---------------------------------------------------------------------
INSERT INTO event_members (event_id, user_id) VALUES
  (1, pg_temp.uid('minh.tran')), (1, pg_temp.uid('bao.le')), (1, pg_temp.uid('an.vo')),
  (2, pg_temp.uid('minh.tran')), (2, pg_temp.uid('duc.hoang')),
  (3, pg_temp.uid('an.vo')),     (3, pg_temp.uid('minh.tran')),
  (5, pg_temp.uid('bao.le')),
  (6, pg_temp.uid('bao.le'));

-- ---------------------------------------------------------------------
-- 4) Task
--    Quy ước: PHOTOGRAPHER hạn = giờ bắt đầu sự kiện;
--             RECAP hạn = giờ kết thúc + 7 ngày
-- ---------------------------------------------------------------------
INSERT INTO tasks (event_id, type, title, dimensions, deadline, assignee_id, status, progress, notes, completed_at) VALUES
-- Sự kiện 1
(1, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(1, '09:00'), pg_temp.uid('minh.tran'), 'IN_PROGRESS', 75, 'Dùng key visual đã duyệt. Xuất banner mạng xã hội 1920 × 1080 px.', NULL),
(1, 'BACKDROP',          'Backdrop',          '600 × 300 cm',   pg_temp.vn(1, '17:00'), pg_temp.uid('bao.le'),    'IN_PROGRESS', 50, NULL, NULL),
(1, 'BANDROLL',          'Bandroll',          '500 × 80 cm',    pg_temp.vn(1, '17:00'), pg_temp.uid('bao.le'),    'COMPLETED',  100, NULL, now() - interval '1 day'),
(1, 'STANDEE',           'Standee',           '80 × 180 cm',    pg_temp.vn(1, '17:00'), pg_temp.uid('an.vo'),     'COMPLETED',  100, NULL, now() - interval '1 day'),
(1, 'INVITATION_LETTER', 'Thư mời',           'A5 · 148 × 210 mm', pg_temp.vn(0, '23:00'), pg_temp.uid('minh.tran'), 'IN_REVIEW', 90, 'Chờ BCH duyệt nội dung.', NULL),
(1, 'OTHER',             'Instagram story',   '1080 × 1920 px', pg_temp.vn(1, '12:00'), pg_temp.uid('an.vo'),     'COMPLETED',  100, NULL, now() - interval '1 day'),
(1, 'PHOTOGRAPHER',      'Phân công chụp ảnh', '1 thợ chụp ảnh', pg_temp.vn(3, '09:00'), pg_temp.uid('minh.tran'), 'TODO', 0, NULL, NULL),
(1, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(10, '16:00'), pg_temp.uid('an.vo'),    'TODO', 0, NULL, NULL),
-- Sự kiện 2
(2, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(5, '12:00'), pg_temp.uid('minh.tran'), 'IN_PROGRESS', 30, NULL, NULL),
(2, 'STANDEE',           'Standee',           '80 × 180 cm',    pg_temp.vn(6, '12:00'), pg_temp.uid('duc.hoang'), 'TODO', 0, NULL, NULL),
(2, 'INVITATION_LETTER', 'Thư mời diễn giả',  'A5',             pg_temp.vn(4, '12:00'), pg_temp.uid('duc.hoang'), 'COMPLETED', 100, NULL, now() - interval '2 hours'),
(2, 'OTHER',             'Thẻ diễn giả',      '1080 × 1350 px', pg_temp.vn(6, '18:00'), NULL,                     'TODO', 0, NULL, NULL),
(2, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(15, '16:00'), pg_temp.uid('duc.hoang'), 'TODO', 0, NULL, NULL),
-- Sự kiện 3 (đã kết thúc, recap còn nợ)
(3, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(-7, '12:00'), pg_temp.uid('an.vo'),     'COMPLETED', 100, NULL, now() - interval '8 days'),
(3, 'BACKDROP',          'Backdrop',          '400 × 250 cm',   pg_temp.vn(-6, '12:00'), pg_temp.uid('minh.tran'), 'COMPLETED', 100, NULL, now() - interval '7 days'),
(3, 'STANDEE',           'Standee',           '80 × 180 cm',    pg_temp.vn(-6, '12:00'), pg_temp.uid('minh.tran'), 'COMPLETED', 100, NULL, now() - interval '7 days'),
(3, 'OTHER',             'Video teaser',      '1080 × 1920 px', pg_temp.vn(-5, '12:00'), pg_temp.uid('an.vo'),     'COMPLETED', 100, NULL, now() - interval '6 days'),
(3, 'PHOTOGRAPHER',      'Phân công chụp ảnh', '2 thợ chụp ảnh', pg_temp.vn(-4, '16:00'), pg_temp.uid('an.vo'),     'COMPLETED', 100, NULL, now() - interval '6 days'),
(3, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(3, '18:00'),  pg_temp.uid('an.vo'),     'IN_PROGRESS', 40, 'Đăng album ảnh và bài highlight.', NULL),
-- Sự kiện 4 (nháp)
(4, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(12, '12:00'), NULL, 'TODO', 0, NULL, NULL),
(4, 'BACKDROP',          'Backdrop',          '600 × 300 cm',   pg_temp.vn(13, '12:00'), NULL, 'TODO', 0, NULL, NULL),
(4, 'PHOTOGRAPHER',      'Phân công chụp ảnh', '1 thợ chụp ảnh', pg_temp.vn(16, '18:00'), NULL, 'TODO', 0, NULL, NULL),
(4, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(23, '20:00'), NULL, 'TODO', 0, NULL, NULL),
-- Sự kiện 5 (đã hoàn thành)
(5, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(-16, '12:00'), pg_temp.uid('bao.le'), 'COMPLETED', 100, NULL, now() - interval '17 days'),
(5, 'STANDEE',           'Standee',           '80 × 180 cm',    pg_temp.vn(-15, '12:00'), pg_temp.uid('bao.le'), 'COMPLETED', 100, NULL, now() - interval '16 days'),
(5, 'PHOTOGRAPHER',      'Phân công chụp ảnh', '1 thợ chụp ảnh', pg_temp.vn(-13, '08:30'), pg_temp.uid('bao.le'), 'COMPLETED', 100, NULL, now() - interval '15 days'),
(5, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(-6, '17:00'),  pg_temp.uid('bao.le'), 'COMPLETED', 100, NULL, now() - interval '11 days'),
-- Sự kiện 6
(6, 'BANNER',            'Banner',            '1920 × 1080 px', pg_temp.vn(15, '12:00'), pg_temp.uid('bao.le'), 'TODO', 0, NULL, NULL),
(6, 'PHOTOGRAPHER',      'Phân công chụp ảnh', '1 thợ chụp ảnh', pg_temp.vn(20, '18:00'), pg_temp.uid('bao.le'), 'TODO', 0, NULL, NULL),
(6, 'RECAP',             'Recap sự kiện',     NULL,             pg_temp.vn(27, '20:30'), pg_temp.uid('bao.le'), 'TODO', 0, NULL, NULL);

-- ---------------------------------------------------------------------
-- 5) Một vài thông báo & hoạt động mẫu
--    (Nhắc nhở tự động hằng ngày sẽ do API sinh ra khi khởi động.)
-- ---------------------------------------------------------------------
INSERT INTO notifications (recipient_id, event_id, task_id, type, title, body, sent_by, created_at, read_at) VALUES
(pg_temp.uid('minh.tran'), 1, NULL, 'EVENT_ASSIGNED', 'Bạn được phân công sự kiện mới',
  'Mai Anh đã phân công bạn vào "Ngày hội Sáng tạo CSE".', pg_temp.uid('mai.anh'), now() - interval '5 days', now() - interval '4 days'),
(pg_temp.uid('bao.le'), 1, NULL, 'EVENT_ASSIGNED', 'Bạn được phân công sự kiện mới',
  'Mai Anh đã phân công bạn vào "Ngày hội Sáng tạo CSE".', pg_temp.uid('mai.anh'), now() - interval '5 days', NULL),
(pg_temp.uid('an.vo'), 1, NULL, 'EVENT_ASSIGNED', 'Bạn được phân công sự kiện mới',
  'Mai Anh đã phân công bạn vào "Ngày hội Sáng tạo CSE".', pg_temp.uid('mai.anh'), now() - interval '5 days', NULL),
(pg_temp.uid('minh.tran'), 1, 1, 'MANUAL_REMIND', 'Nhắc việc: Banner',
  'Mai Anh nhắc bạn hoàn thành "Banner" cho "Ngày hội Sáng tạo CSE" trước hạn.', pg_temp.uid('mai.anh'), now() - interval '3 hours', NULL);

INSERT INTO activity_logs (event_id, actor_id, message, created_at) VALUES
(1, pg_temp.uid('mai.anh'), 'Mai Anh đã tạo sự kiện và phân công cho BTT.', now() - interval '5 days'),
(1, pg_temp.uid('bao.le'),  'Bảo Lê đã hoàn thành Bandroll.',  now() - interval '1 day'),
(1, pg_temp.uid('an.vo'),   'An Võ đã hoàn thành Standee.',    now() - interval '1 day'),
(1, pg_temp.uid('an.vo'),   'An Võ đã hoàn thành Instagram story.', now() - interval '20 hours'),
(1, pg_temp.uid('minh.tran'), 'Minh Trần đã gửi Thư mời cho BCH duyệt.', now() - interval '6 hours'),
(3, pg_temp.uid('an.vo'),   'An Võ đã hoàn thành Phân công chụp ảnh.', now() - interval '6 days');

COMMIT;

-- Kiểm tra nhanh
SELECT role, count(*) AS so_tai_khoan FROM users GROUP BY role ORDER BY role;
SELECT e.id, e.name, e.status, count(t.*) AS so_task
FROM events e LEFT JOIN tasks t ON t.event_id = e.id
GROUP BY e.id ORDER BY e.id;
