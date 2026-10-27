# STUDY.md — Nhật ký dựng dự án CSE Task Manage

> Tài liệu này ghi lại **toàn bộ quá trình** tạo ra dự án, từ đọc thiết kế Figma tới khi web và app mobile chạy được, để bạn hiểu cấu trúc và học cách làm web + mobile.
> Đọc theo thứ tự từ trên xuống. Mỗi phần có **"📂 Xem file"** chỉ tới code thật để bạn mở ra đối chiếu.

---

## Mục lục

1. [Bức tranh tổng thể](#1-bức-tranh-tổng-thể)
2. [Bước 1 — Đọc Figma, liệt kê màn hình, thiết kế DB](#2-bước-1--đọc-figma-liệt-kê-màn-hình-thiết-kế-db)
3. [Bước 2 — Viết schema.sql và seed.sql](#3-bước-2--viết-schemasql-và-seedsql)
4. [Bước 3a — Dựng API (Express + Prisma)](#4-bước-3a--dựng-api-express--prisma)
5. [Bước 3b — Dựng web (Next.js)](#5-bước-3b--dựng-web-nextjs)
6. [Bước 3c — Dựng app mobile (Expo / React Native)](#6-bước-3c--dựng-app-mobile-expo--react-native)
7. [Hệ thống thông báo & nhắc nhở](#7-hệ-thống-thông-báo--nhắc-nhở)
8. [Lần theo một luồng dữ liệu từ đầu tới cuối](#8-lần-theo-một-luồng-dữ-liệu-từ-đầu-tới-cuối)
9. [Kiểm thử](#9-kiểm-thử)
10. [Sự cố gặp phải & cách xử lý](#10-sự-cố-gặp-phải--cách-xử-lý)
11. [Các quyết định thiết kế & đánh đổi](#11-các-quyết-định-thiết-kế--đánh-đổi)
12. [Bài tập tự luyện](#12-bài-tập-tự-luyện)
13. [Từ điển thuật ngữ](#13-từ-điển-thuật-ngữ)
14. [Vòng 2 — Chỉnh sửa theo phản hồi](#14-vòng-2--chỉnh-sửa-theo-phản-hồi)
15. [Vòng 3 — iPhone nhận thông báo miễn phí: PWA + Web Push](#15-vòng-3--iphone-nhận-thông-báo-miễn-phí-pwa--web-push)

---

## 1. Bức tranh tổng thể

### 1.1. App làm gì?

Một tổ chức (VD: Đoàn – Hội khoa CSE) tổ chức nhiều sự kiện. Mỗi sự kiện cần nhiều **ấn phẩm truyền thông** (banner, backdrop, standee…), cần **người chụp ảnh** và cần **bài recap** sau sự kiện.

| Vai trò | Làm gì |
|---|---|
| **Admin** | Quản lý tài khoản (tạo, sửa, đổi vai trò), xem và chỉnh mọi task |
| **BCH** (Ban Chấp hành) | Tạo sự kiện, chọn ấn phẩm, **chọn BTT phụ trách**, sửa sự kiện (nếu chưa diễn ra), bấm "Nhắc" từng task |
| **BTT** (Ban Truyền thông) | Xem sự kiện được giao, đổi trạng thái task, nhận nhắc nhở tự động hằng ngày |

Task **không giao cho từng người**: BCH chọn nhóm BTT phụ trách sự kiện, cả nhóm cùng thấy và cùng làm mọi task của sự kiện đó.

**Bản tin 09:00 mỗi ngày** gửi cho mỗi BTT còn việc: **1** thông báo trên điện thoại + **1** email, gộp mọi task chưa xong, cho tới khi task được đánh dấu hoàn thành. Trong đó:
- **Phân công chụp ảnh**: chỉ đưa vào từ 3 ngày trước sự kiện.
- **Recap sự kiện**: đưa vào ngay khi sự kiện kết thúc (hạn recap = kết thúc + 7 ngày).

### 1.2. Kiến trúc 3 tầng

```
 ┌──────────────┐    ┌──────────────┐
 │  Web         │    │  Mobile      │   ← TẦNG GIAO DIỆN (client)
 │  Next.js     │    │  Expo / RN   │     chỉ hiển thị + gọi API
 └──────┬───────┘    └──────┬───────┘
        │   HTTP + JSON     │   (header: Authorization: Bearer <JWT>)
        └────────┬──────────┘
          ┌──────▼───────┐
          │  API         │   ← TẦNG NGHIỆP VỤ (server)
          │  Express     │     kiểm tra quyền, kiểm tra dữ liệu,
          │  + Prisma    │     quy tắc nghiệp vụ, job nhắc nhở
          └──────┬───────┘
                 │  SQL (qua Prisma + thư viện pg)
          ┌──────▼───────┐
          │ PostgreSQL 16│   ← TẦNG DỮ LIỆU
          └──────────────┘
```

**Vì sao tách như vậy?** Web và mobile dùng **chung một API**, nên quy tắc nghiệp vụ (ai được sửa gì, hạn recap tính thế nào…) chỉ viết **một lần** ở server. Client không bao giờ được tin tưởng: mọi kiểm tra quan trọng đều làm lại ở API.

### 1.3. Cấu trúc thư mục (monorepo)

```
CSE Task Manage/
├── CLAUDE.md          ← quy ước dự án (stack, cách làm)
├── README.md          ← cách chạy local + deploy
├── STUDY.md           ← file bạn đang đọc
├── package.json       ← script tiện ích chạy từ thư mục gốc
├── db/
│   ├── schema.sql     ← NGUỒN SỰ THẬT của cấu trúc DB
│   ├── seed.sql       ← dữ liệu mẫu
│   └── data/users.csv ← tài khoản mẫu (nạp bằng \copy)
└── apps/
    ├── api/           ← Express + Prisma (TypeScript)
    ├── web/           ← Next.js 16 + Tailwind CSS 4
    └── mobile/        ← Expo SDK 58 + Expo Router
```

"Monorepo" = nhiều ứng dụng trong một kho git. Ở đây **mỗi app có `node_modules` riêng** (không dùng npm workspaces) vì Next.js và React Native hay xung đột phiên bản React khi dùng chung. Đơn giản hơn cho người mới.

---

## 2. Bước 1 — Đọc Figma, liệt kê màn hình, thiết kế DB

### 2.1. Đọc Figma

File Figma có 11 khung (frame), mỗi khung có bản **Desktop 1440px** và **Mobile 375px**:

| Màn hình Figma | Vai trò | Route web | Route mobile |
|---|---|---|---|
| Sign up | Khách | `/register` | `/register` |
| *(không có, tự thêm)* Sign in | Khách | `/login` | `/login` |
| Admin account management + Create/Edit account | Admin | `/admin/accounts` | `/admin/accounts` |
| Admin task management | Admin | `/admin/tasks` | `/admin/tasks` |
| BCH event list | BCH | `/bch/events` | `/bch/events` |
| BCH event and task creation | BCH | `/bch/events/new`, `/bch/events/[id]/edit` | `/bch/event-form?id=` |
| BTT active event list | BTT | `/btt/events` | `/btt/events` |
| BTT tracking and smart reminders | BTT (+ BCH, Admin) | `/events/[id]`, `/btt/reminders` | như web |

Từ Figma mình rút ra **bảng màu** (design tokens):

| Token | Mã màu | Dùng cho |
|---|---|---|
| navy | `#03045e` | tiêu đề, thanh điều hướng |
| primary | `#0077b6` | nút chính, link |
| sky | `#00b4d8` | thanh tiến độ |
| ice | `#caf0f8` | nền trang, ô nhập |
| line | `#90e0ef` | viền |
| muted | `#53677e` | chữ phụ |

Font: **Inter**. Icon: kiểu Lucide (web dùng `lucide-react`, mobile dùng bộ Feather gần giống).

> 💡 **Mẹo:** trước khi code, luôn liệt kê màn hình + các trường dữ liệu trên từng màn. Các trường đó chính là gợi ý cho bảng DB.

### 2.2. Từ màn hình ra bảng dữ liệu

Cách suy nghĩ: nhìn từng màn và hỏi *"thông tin này là của đối tượng nào?"*

- Bảng tài khoản (tên, username, email, vai trò) → bảng **users**
- Form tạo sự kiện mục 01 (tên, địa điểm, ngày giờ, ghi chú), mục 03 (nội dung), mục 04 (chụp ảnh) → bảng **events**
- Mục 02: mỗi ấn phẩm có kích thước + hạn chót riêng → mỗi ấn phẩm là một dòng trong bảng **tasks**
- Yêu cầu mới: "chọn **nhiều** BTT cho một sự kiện" → quan hệ **nhiều–nhiều** → bảng nối **event_members**
- Chuông thông báo, nhắc nhở → bảng **notifications**
- "Latest activity" → bảng **activity_logs**
- Push thật trên điện thoại cần lưu token thiết bị → bảng **push_tokens**

### 2.3. Sơ đồ quan hệ (ERD)

```
users 1 ───< events (created_by)          một BCH tạo nhiều sự kiện
users >───< events   qua event_members     nhiều BTT ↔ nhiều sự kiện
events 1 ───< tasks                        một sự kiện có nhiều task
users 1 ───< notifications (recipient_id)
users 1 ───< push_tokens                   một người nhiều điện thoại
events 1 ───< activity_logs
```

### 2.4. Phản hồi của bạn và điều chỉnh

Sau khi mình đề xuất, bạn yêu cầu:
1. **Bỏ `user_status`** (Active/Invited/Inactive) → bỏ cả cột trong DB lẫn cột trên giao diện. Thẻ thống kê đổi thành *Tổng / BCH / BTT*.
2. **Thông báo**: chưa cần thật nhưng phải dễ chuyển sang thật → thêm bảng `push_tokens` + lớp "push provider" (xem mục 7).
3. **Hạn recap = kết thúc + 7 ngày**.
4. **Toàn bộ bằng tiếng Việt.**

> 📌 Bài học: luôn **chốt thiết kế dữ liệu trước khi code**. Đổi một cột DB khi đã có API + 2 giao diện tốn công hơn nhiều.

---

## 3. Bước 2 — Viết schema.sql và seed.sql

📂 Xem file: `db/schema.sql`, `db/seed.sql`, `db/data/users.csv`

### 3.1. Vì sao viết SQL tay mà không để Prisma sinh ra?

CLAUDE.md quy định: *"Nạp dữ liệu: psql CLI (schema.sql, seed.sql, \copy từ CSV)"*. Nên `schema.sql` là **nguồn sự thật** (source of truth); Prisma chỉ **đọc lại** cấu trúc DB (`prisma db pull`). Lợi ích: bạn học được SQL thật, dùng được tính năng Postgres mà Prisma không mô tả được (trigger, partial index).

### 3.2. Các kỹ thuật SQL đáng chú ý

**a) ENUM**: giới hạn giá trị hợp lệ ngay trong DB:
```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'BCH', 'BTT');
```

**b) Khoá tự tăng kiểu mới** (thay cho `SERIAL`):
```sql
id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

**c) CHECK constraint**: DB tự chặn dữ liệu sai, kể cả khi code có bug:
```sql
CONSTRAINT tasks_progress_range CHECK (progress BETWEEN 0 AND 100),
-- "hoàn thành" ⇔ có completed_at
CONSTRAINT tasks_completed_consistency CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
```

**d) Trigger**: CHECK không tham chiếu được bảng khác, nên muốn đảm bảo *"chỉ BTT mới vào event_members"* phải dùng trigger (`check_event_member_is_btt`). Thử ngay trong psql:
```sql
INSERT INTO event_members VALUES (1, 2);   -- user 2 là BCH
-- ERROR: Chỉ tài khoản BTT mới được phân công vào sự kiện (user_id=2)
```

**e) Trigger tự cập nhật `updated_at`**: hàm `set_updated_at()` dùng chung cho mọi bảng.

**f) Partial unique index**: chống gửi nhắc nhở trùng:
```sql
CREATE UNIQUE INDEX uq_notifications_daily
  ON notifications(task_id, recipient_id, type, reminder_date)
  WHERE reminder_date IS NOT NULL;
```
Nghĩa là mỗi (task, người nhận, loại nhắc, ngày) chỉ có **một** dòng. Job nhắc nhở chạy lại 10 lần/ngày cũng không spam. Thông báo thủ công có `reminder_date = NULL` nên không bị ràng buộc.

**g) Mã task tự sinh** `TSK-001` bằng sequence:
```sql
code varchar(20) DEFAULT ('TSK-' || lpad(nextval('task_code_seq')::text, 3, '0'))
```

**h) `timestamptz`**: luôn lưu thời điểm kèm múi giờ (Postgres lưu UTC). Hiển thị giờ VN là việc của giao diện.

### 3.3. seed.sql: dữ liệu mẫu "luôn mới"

- `\copy staging_users FROM 'data/users.csv'`: `\copy` là lệnh **của psql** (chạy phía máy bạn), khác `COPY` (chạy phía server). Vì đường dẫn tương đối nên **phải `cd db` trước**.
- Mật khẩu băm ngay trong SQL: `crypt(password, gen_salt('bf', 10))` (bcrypt, từ extension `pgcrypto`). Thư viện `bcryptjs` ở API đọc được chuỗi băm này.
- Ngày sự kiện tính **tương đối theo hôm nay**: hàm tạm `pg_temp.vn(3, '09:00')` = 09:00 giờ VN của ngày (hôm nay + 3). Nhờ vậy lúc nào nạp lại cũng có sự kiện "3 ngày nữa" để demo nhắc chụp ảnh, sự kiện "4 ngày trước" để demo nhắc recap.
- `TRUNCATE ... RESTART IDENTITY CASCADE` đầu file → chạy lại bao nhiêu lần cũng được.

---

## 4. Bước 3a — Dựng API (Express + Prisma)

📂 Xem thư mục: `apps/api/src/`

### 4.1. Cấu trúc

```
src/
├── index.ts          ← khởi động: mở cổng + lên lịch cron
├── app.ts            ← lắp ráp Express: middleware → routes → xử lý lỗi
├── config.ts         ← đọc .env, kiểm tra biến bắt buộc
├── prisma.ts         ← một PrismaClient dùng chung
├── middleware/
│   ├── auth.ts       ← xác thực JWT, phân quyền theo vai trò
│   └── error.ts      ← biến mọi lỗi thành JSON tiếng Việt
├── routes/           ← mỗi file một nhóm endpoint
│   ├── auth.ts       /api/auth/*
│   ├── users.ts      /api/users/*
│   ├── events.ts     /api/events/*
│   ├── tasks.ts      /api/tasks/*
│   ├── notifications.ts  /api/notifications, /api/reminders, /api/push-tokens
│   └── cron.ts       /api/cron/daily-digest (cho dịch vụ hẹn giờ bên ngoài)
├── services/         ← logic nghiệp vụ dùng lại ở nhiều route
│   ├── presenters.ts ← DB record → JSON (+ trường tính toán)
│   ├── eventAccess.ts← ai được xem/sửa sự kiện nào
│   ├── notify.ts     ← tạo thông báo + đẩy push
│   └── digest.ts     ← bản tin 09:00 gộp mọi task còn lại
├── email/            ← "email provider" (log | Resend) + mẫu email HTML
├── push/index.ts     ← "push provider": log hoặc Expo
├── lib/              ← tiện ích nhỏ (thời gian VN, nhãn tiếng Việt, lỗi HTTP)
└── scripts/          ← smoke test, chạy nhắc nhở thủ công
```

### 4.2. Danh sách endpoint

| Method | Đường dẫn | Ai dùng | Làm gì |
|---|---|---|---|
| POST | `/api/auth/register` | Khách | Đăng ký (chỉ BCH/BTT) |
| POST | `/api/auth/login` | Khách | Đăng nhập bằng username hoặc email → JWT |
| GET | `/api/auth/me` | Mọi người | Thông tin bản thân |
| POST | `/api/auth/change-password` | Mọi người | Đổi mật khẩu |
| GET | `/api/users` | Admin | Danh sách + tìm kiếm + phân trang + thống kê |
| POST / PATCH / DELETE | `/api/users[/:id]` | Admin | Tạo / sửa / xoá tài khoản |
| GET | `/api/users/options?role=BTT` | Admin, BCH | Danh sách rút gọn để chọn người |
| GET | `/api/events` | Mọi người | Danh sách **theo vai trò** + thống kê |
| GET | `/api/events/:id` | Có quyền xem | Chi tiết + hoạt động + `permissions` |
| POST | `/api/events` | BCH | Tạo (nháp hoặc gửi luôn) |
| PUT | `/api/events/:id` | BCH chủ / Admin | Sửa (chỉ khi chưa diễn ra) |
| DELETE | `/api/events/:id` | BCH (nháp) / Admin | Xoá |
| GET | `/api/tasks` | Admin | Bảng tất cả task + thống kê |
| GET | `/api/tasks/export.csv` | Admin | Xuất CSV |
| PATCH | `/api/tasks/:id` | Admin (mọi trường), BTT (chỉ trạng thái) | Cập nhật task |
| POST | `/api/tasks/:id/remind` | BCH chủ / Admin | Gửi nhắc việc |
| GET | `/api/notifications` | Mọi người | Hộp thư |
| GET | `/api/reminders` | BTT | Thẻ nhắc nhở thông minh |
| POST/DELETE | `/api/push-tokens` | Mọi người | Đăng ký / gỡ token điện thoại |
| POST | `/api/admin/run-digest` | Admin | Gửi bản tin hằng ngày ngay (demo) |
| POST | `/api/cron/daily-digest` | Dịch vụ hẹn giờ (header `x-cron-secret`) | Gửi bản tin, dùng khi deploy |

### 4.3. Một request đi qua những đâu?

```
Request → cors → express.json() → router → requireAuth → requireRole → handler
                                                                         │
                                       zod.parse(req.body) ◄─────────────┤ kiểm tra dữ liệu
                                       prisma.xxx(...)     ◄─────────────┤ đọc/ghi DB
                                       presentXxx(...)     ◄─────────────┤ định dạng JSON
                                                                         ▼
                                                                  res.json(...)
   (bất kỳ lỗi nào ném ra) ─────────────────────────────► errorHandler → JSON lỗi
```

### 4.4. Xác thực: bcrypt + JWT

📂 `src/routes/auth.ts`, `src/middleware/auth.ts`

1. **Đăng ký**: mật khẩu được **băm** bằng bcrypt (`bcrypt.hash(pw, 10)`) rồi mới lưu. Không bao giờ lưu mật khẩu thô.
2. **Đăng nhập**: so sánh bằng `bcrypt.compare`. Đúng → ký một **JWT** chứa `{ sub: userId, role }` bằng `JWT_SECRET`.
3. **Mỗi request sau đó**: client gửi `Authorization: Bearer <token>`. Middleware `requireAuth` xác minh chữ ký, rồi **đọc lại user từ DB** (để nếu Admin vừa đổi vai trò thì có hiệu lực ngay).
4. Thông báo lỗi đăng nhập luôn là "Sai tên đăng nhập hoặc mật khẩu" cho cả 2 trường hợp, tránh lộ việc username có tồn tại hay không.

### 4.5. Kiểm tra dữ liệu bằng zod

```ts
const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').regex(/\d/, '...'),
  role: z.enum(['BCH', 'BTT']),   // ← đăng ký KHÔNG được chọn ADMIN
});
const data = registerSchema.parse(req.body);   // sai → ném ZodError → 400
```
`errorHandler` biến `ZodError` thành `{ error, details: [{field, message}] }` → giao diện hiện lỗi ngay dưới ô nhập.

### 4.6. Prisma: ORM có kiểu TypeScript

📂 `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `src/prisma.ts`

- `prisma db pull` đọc DB → cập nhật `schema.prisma`. Mình đổi tên sang kiểu JS bằng `@map`/`@@map` (VD bảng `event_members` → model `EventMember`, cột `starts_at` → field `startsAt`). Lần `db pull` sau vẫn giữ các đổi tên này.
- `prisma generate` sinh **Prisma Client** vào `src/generated/prisma` (bị .gitignore, tự sinh khi `npm install`).
- **Prisma 7** kết nối DB qua *driver adapter* (`@prisma/adapter-pg` dùng thư viện `pg`). Không còn "query engine" viết bằng Rust như Prisma 5/6.

Ví dụ truy vấn có kiểu:
```ts
const events = await prisma.event.findMany({
  where: { status: 'PUBLISHED', members: { some: { userId: user.id } } },
  include: { tasks: true, createdBy: { select: { fullName: true } } },
});
// events[0].tasks[0].deadline có kiểu Date — gõ sai tên field là TypeScript báo lỗi ngay
```

**Transaction**: tạo sự kiện + thành viên + task + log phải **cùng thành công hoặc cùng thất bại**:
```ts
await prisma.$transaction(async (tx) => {
  const created = await tx.event.create({...});
  await syncTasks(tx, created.id, d);
  await tx.activityLog.create({...});
});
```

### 4.7. Phân quyền theo vai trò

📂 `src/services/eventAccess.ts`

Một hàm duy nhất quyết định "ai thấy sự kiện nào":
```ts
export function visibleEventsWhere(user) {
  switch (user.role) {
    case 'ADMIN': return {};                                  // thấy tất cả
    case 'BCH':   return { createdById: user.id };            // chỉ của mình
    case 'BTT':   return { status: { not: 'DRAFT' },          // đã gửi
                           members: { some: { userId: user.id } } }; // & được giao
  }
}
```
API trả kèm `permissions: { canEdit, canRemind, canUpdateTasks, canDelete }` để giao diện biết nên hiện nút nào. **Nhưng** API vẫn kiểm tra lại khi nhận request; ẩn nút chỉ là trải nghiệm, không phải bảo mật.

### 4.8. Quy tắc nghiệp vụ chính (đều nằm ở API)

| Quy tắc | Ở đâu |
|---|---|
| Đăng ký chỉ BCH/BTT | `routes/auth.ts` (zod) |
| BCH chỉ sửa khi sự kiện **chưa diễn ra** | `routes/events.ts` PUT |
| Backdrop/Bandroll/Standee **bắt buộc kích thước** | `deliverableSchema.superRefine` |
| Gửi sự kiện phải chọn ít nhất 1 BTT | `eventSchema.superRefine` |
| Luôn có task Recap, hạn = kết thúc + 7 ngày | `syncTasks()` |
| Task Phân công chụp ảnh, hạn = giờ bắt đầu | `syncTasks()` |
| BTT chỉ được đổi `status`/`progress` | `routes/tasks.ts` PATCH |
| Mọi task xong → sự kiện tự chuyển "Hoàn thành" | `syncEventCompletion()` |
| Admin đổi BTT sang vai trò khác → gỡ khỏi các sự kiện | `routes/users.ts` PATCH |

### 4.9. "Presenter": trường tính toán không lưu DB

📂 `src/services/presenters.ts`

"Quá hạn", "% tiến độ", "giai đoạn sự kiện" **không lưu** vào DB vì chúng thay đổi theo thời gian (lưu sẽ sai ngay sau 1 phút). Presenter tính khi trả về:
```ts
isOverdue: t.status !== 'COMPLETED' && t.deadline < now,
phase: now < e.startsAt ? 'UPCOMING' : now <= e.endsAt ? 'ONGOING' : 'POST_EVENT',
```

---

## 5. Bước 3b — Dựng web (Next.js)

📂 Xem thư mục: `apps/web/src/`

### 5.1. Next.js App Router: thư mục = đường dẫn

```
src/app/
├── layout.tsx                 ← khung HTML chung + <AuthProvider>
├── page.tsx                   ← "/" → chuyển hướng theo vai trò
├── login/page.tsx             ← "/login"
├── register/page.tsx          ← "/register"
├── admin/
│   ├── layout.tsx             ← bọc <AppShell roles={['ADMIN']}> cho mọi trang con
│   ├── accounts/page.tsx      ← "/admin/accounts"
│   └── tasks/page.tsx         ← "/admin/tasks"
├── bch/events/[id]/edit/page.tsx  ← "[id]" = tham số động → "/bch/events/2/edit"
└── events/[id]/page.tsx       ← chi tiết sự kiện, dùng chung mọi vai trò
```

`layout.tsx` lồng nhau: trang `/admin/tasks` được bọc bởi `app/layout.tsx` → `app/admin/layout.tsx` → `page.tsx`. Nhờ vậy kiểm tra quyền Admin chỉ viết **một lần** trong `admin/layout.tsx`.

### 5.2. Server Component vs Client Component

Next.js mặc định render ở server. Dự án này cần token trong trình duyệt và nhiều tương tác (form, dropdown), nên các trang dùng `'use client'` ở dòng đầu, tức chạy như ứng dụng một trang (SPA): trình duyệt tải trang → gọi API lấy dữ liệu → hiển thị. Đây là cách đơn giản nhất khi đã có API riêng.

### 5.3. Các mảnh ghép dùng lại

| File | Vai trò |
|---|---|
| `lib/api.ts` | Hàm `api()` gọi API: tự gắn token, tự đổi JSON, 401 thì về trang đăng nhập |
| `lib/auth.tsx` | **React Context** giữ user hiện tại cho mọi trang; `useRequireRole()` chặn sai vai trò |
| `lib/useApi.ts` | Hook `useApi(path)` → `{ data, error, loading, reload }`; có `pollMs` để tự làm mới |
| `lib/format.ts` | Định dạng ngày giờ theo giờ VN, nhãn tiếng Việt cho enum |
| `lib/types.ts` | Kiểu dữ liệu API trả về |
| `components/ui.tsx` | Button, Field, Badge, StatCard, Modal, Chips… theo Figma |
| `components/AppShell.tsx` | Thanh điều hướng theo vai trò + chuông thông báo |
| `components/EventForm.tsx` | Form tạo/sửa sự kiện (dùng cho cả trang tạo và trang sửa) |

### 5.4. React hooks cần nắm

```tsx
const [search, setSearch] = useState('');              // trạng thái cục bộ
const q = useDebounced(search, 300);                   // chờ ngừng gõ 300ms mới tìm
const { data, reload } = useApi(`/users${qs({ search: q })}`);  // đổi q → tự gọi lại API
useEffect(() => { ... }, [deps]);                      // chạy "tác dụng phụ" khi deps đổi
```
Luồng: gõ chữ → `search` đổi → sau 300ms `q` đổi → `path` đổi → `useApi` gọi API → `data` đổi → giao diện vẽ lại.

### 5.5. Tailwind CSS 4: style bằng class

📂 `src/app/globals.css`

Màu Figma được khai báo một lần trong `@theme`:
```css
@theme {
  --color-navy: #03045e;
  --color-primary: #0077b6;
}
```
→ Tailwind tự sinh class `bg-navy`, `text-primary`, `border-line`… Viết responsive bằng tiền tố: `grid sm:grid-cols-3` = 1 cột trên điện thoại, 3 cột từ 640px. Thanh điều hướng: `hidden md:flex` (desktop) và `md:hidden` (hàng tab mobile).

### 5.6. Phần thêm so với Figma

- **Ô "Ban Truyền thông phụ trách"** nằm ngay trong mục 01 · Thông tin chung: chọn nhiều BTT bằng bộ chọn có ô tìm kiếm. Ấn phẩm không giao riêng cho ai (xem mục 14).
- **Trang Đăng nhập, Đổi mật khẩu, Thông báo** (Figma chưa có), theo cùng phong cách.
- **Nút "Nhắc"** ở từng task (BCH), **nút "Chạy nhắc nhở"** (Admin, để demo).
- Ô **Họ và tên** trong form đăng ký (vì bảng ở mọi nơi hiển thị họ tên).

---

## 6. Bước 3c — Dựng app mobile (Expo / React Native)

📂 Xem thư mục: `apps/mobile/src/`

### 6.1. React Native khác web thế nào?

| Web (React DOM) | Mobile (React Native) |
|---|---|
| `<div>` | `<View>` |
| `<p>`, `<span>` | `<Text>` (chữ **bắt buộc** nằm trong `<Text>`) |
| `<input>` | `<TextInput>` |
| `<button onClick>` | `<Pressable onPress>` |
| CSS / Tailwind class | `style={{ ... }}` hoặc `StyleSheet.create` (flexbox mặc định theo **cột**) |
| `localStorage` | `expo-secure-store` (Keychain/Keystore, mã hoá) |
| cuộn trang tự nhiên | phải bọc `<ScrollView>` |

Logic (gọi API, context đăng nhập, hook `useApi`, định dạng ngày) **gần như giống hệt web**. Đó là lợi ích lớn của việc học React: một tư duy, hai nền tảng.

### 6.2. Expo Router: điều hướng bằng file (giống Next.js)

```
src/app/
├── _layout.tsx           ← nạp font Inter, <AuthProvider>, <Stack>
├── index.tsx             ← mở app → chuyển theo vai trò
├── login.tsx, register.tsx, change-password.tsx
└── (app)/                ← "route group": tên trong ngoặc KHÔNG vào URL
    ├── _layout.tsx       ← chặn chưa đăng nhập; <Stack> cho các màn chi tiết
    ├── home.tsx          ← MỘT màn chứa mọi tab của vai trò (xem mục 14.4)
    ├── bch/edit/[id].tsx ← sửa sự kiện
    ├── events/[id].tsx
    └── notifications.tsx
src/screens/              ← nội dung từng tab (KHÔNG phải route)
    AdminAccounts, AdminTasks, BchNewEvent, BchEvents, BttEvents, BttReminders
```
Chuyển màn: `router.push('/events/3')`, quay lại: `router.back()`, thay màn hiện tại: `router.replace(...)`.

### 6.3. Những điểm riêng của mobile

- **Địa chỉ API tự động** (`lib/api.ts`): điện thoại không hiểu `localhost` là máy Mac của bạn. App đọc `Constants.expoConfig.hostUri` (IP của máy chạy `expo start`) rồi ghép `:4000/api`. Muốn chỉ định thì đặt `EXPO_PUBLIC_API_URL`.
- **Giờ VN tự tính** (`lib/format.ts`): engine JavaScript Hermes trên điện thoại có thể thiếu dữ liệu múi giờ, nên bản mobile tự cộng 7 giờ thay vì dùng `Intl` như web.
- **Chọn ngày giờ, dropdown, chọn người**: tự vẽ trong `components/pickers.tsx` (bottom sheet + lịch tháng tiếng Việt + cột giờ/phút), giống hệt nhau trên iOS, Android và web; không dùng picker mặc định của hệ điều hành.
- **Kéo để làm mới**: `<ScrollView refreshControl={<RefreshControl .../>}>` trong `components/ui.tsx` → `Screen`.

---

## 7. Hệ thống thông báo & nhắc nhở

Đây là phần "khó" nhất, thiết kế để **demo được ngay** mà **sau này bật push thật không cần sửa code**.

### 7.1. Bản tin hằng ngày 09:00

📂 `apps/api/src/services/digest.ts`, `src/index.ts`, `src/routes/cron.ts`

```ts
cron.schedule('0 9 * * *', runDailyDigest, { timezone: 'Asia/Ho_Chi_Minh' });
```
Mỗi sáng 09:00, với **từng BTT** có sự kiện đang thực hiện, job gom các task **chưa xong** (`collectForUser`) và gắn cờ (`reminderFlag`):

| Task | Đưa vào bản tin khi | Cờ |
|---|---|---|
| Phân công chụp ảnh | hôm nay ≥ ngày sự kiện − 3 | `PHOTO` (Xác nhận chụp ảnh) |
| Recap sự kiện | sự kiện đã kết thúc (now ≥ ends_at) | `RECAP` (Cần đăng recap) |
| Ấn phẩm đã quá hạn | luôn | `OVERDUE` |
| Ấn phẩm hạn trong 48 giờ | luôn | `SOON` |
| Ấn phẩm còn xa hạn | luôn (không gắn cờ) | — |

Rồi gọi **một** lần `notify({ type: 'DAILY_DIGEST', ..., email })`: 1 dòng trong hộp thư + 1 push (tiêu đề "Bạn còn N việc cần làm hôm nay", nội dung tóm tắt) + 1 email HTML liệt kê đầy đủ theo từng sự kiện (`email/templates.ts`).

So sánh **theo ngày lịch Việt Nam** (`lib/time.ts → vnDayDiff`), vì "3 ngày trước sự kiện" là theo lịch chứ không phải đúng 72 giờ.

**Chống trùng**: mỗi bản tin lưu `reminder_date` = hôm nay. Unique index `(recipient_id, type, reminder_date)` + `createManyAndReturn({ skipDuplicates: true })` (tức `INSERT ... ON CONFLICT DO NOTHING`) đảm bảo mỗi người chỉ nhận **1 bản tin/ngày**, dù job chạy bao nhiêu lần. Nhờ vậy có thể gọi job từ **nhiều nơi** một cách an toàn:
- `node-cron` bên trong API (khi server luôn chạy),
- **gửi bù** khi API khởi động sau 09:00 (`catchUpDigest`, hữu ích khi Render Free vừa "thức dậy"),
- dịch vụ ngoài gọi `POST /api/cron/daily-digest` với header `x-cron-secret` (GitHub Actions: `.github/workflows/daily-digest.yml`),
- Admin bấm **Gửi bản tin ngay**.

### 7.2. Một đường ống duy nhất cho mọi thông báo

📂 `apps/api/src/services/notify.ts`

```
notify({ recipientIds, type, title, body, ... })
   ├─ 1. INSERT vào bảng notifications   → hiện ở chuông web + màn Thông báo
   └─ 2. getPushProvider().send(...)      → đẩy tới điện thoại (nếu có token)
```
Dù là bản tin hằng ngày, BCH bấm "Nhắc", hay BTT được phân công, **tất cả** đều gọi `notify()`. Nếu truyền thêm `email`, `notify()` gửi email qua **email provider** (`email/index.ts`, cùng kiểu Strategy như push ở mục 7.3): `EMAIL_PROVIDER=log` in ra console, `EMAIL_PROVIDER=resend` gọi REST API của Resend bằng `fetch`, không cần cài SDK.

### 7.3. Push provider: mẫu thiết kế Strategy

📂 `apps/api/src/push/index.ts`

```ts
interface PushProvider { send(message): Promise<PushResult> }
class LogPushProvider  implements PushProvider { ... console.log ... }   // PUSH_PROVIDER=log
class ExpoPushProvider implements PushProvider { ... Expo Push API ... } // PUSH_PROVIDER=expo
```
Code nghiệp vụ chỉ biết interface `PushProvider`. Đổi sang push thật = **đổi 1 dòng trong `.env`**. Muốn dùng Firebase thì viết thêm một class, không đụng vào chỗ khác. Provider Expo còn tự **xoá token hỏng** (`DeviceNotRegistered`) khi người dùng gỡ app.

### 7.4. Phía điện thoại: 2 chế độ

📂 `apps/mobile/src/lib/notifications.ts`, `src/lib/auth.tsx`

```
Đăng nhập xong → setupNotifications()
    │
    ├─ Có EAS projectId + máy thật + lấy được token?
    │      CÓ  → POST /push-tokens → chế độ "push"  (nhận cả khi app tắt)
    │      KHÔNG → chế độ "polling" (demo):
    │               mỗi 30s gọi GET /notifications?after=<id cuối>
    │               có cái mới → scheduleNotificationAsync() hiện banner
    │
    └─ Bấm vào thông báo → mở /events/<id>
Đăng xuất → DELETE /push-tokens (máy này thôi nhận thông báo của tài khoản cũ)
```
Ở menu avatar và màn Thông báo, app ghi rõ đang chạy chế độ nào.

### 7.5. "Nhắc nhở thông minh" khác "hộp thư" thế nào?

- **Hộp thư** (`GET /notifications`): **lịch sử** những gì đã gửi.
- **Thẻ nhắc nhở** (`GET /reminders`): tính **trực tiếp từ task** ở thời điểm hiện tại, luôn đúng, kể cả khi job chưa chạy. Nút "Đã hiểu" chỉ ẩn thẻ trong hôm nay; nút "Đánh dấu hoàn thành" mới thực sự dừng nhắc.

---

## 8. Lần theo một luồng dữ liệu từ đầu tới cuối

**Kịch bản:** BCH Mai Anh tạo sự kiện "Hội thảo AI", chọn Banner + Backdrop, chọn 2 BTT là Minh và An, bấm **"Gửi & phân công task"**.

1. **Web** (`components/EventForm.tsx → submit(true)`): kiểm tra nhanh phía trình duyệt (`validate`) → đổi ngày giờ nhập sang ISO bằng `fromInputs('2026-11-05', '09:00')` → `api('/events', { method: 'POST', body })`.
2. **API** `POST /api/events`:
   - `requireAuth` giải mã JWT → `req.user = Mai Anh (BCH)`; `requireRole('BCH')` ✔
   - `eventSchema.parse(body)` ✔ (Backdrop có kích thước, Minh/An nằm trong `memberIds`…)
   - `assertMembersAreBtt` ✔
   - **Transaction**: `INSERT events` → `INSERT event_members` (trigger DB kiểm tra là BTT) → `syncTasks` tạo 4 task: Banner, Backdrop, Phân công chụp ảnh, Recap (hạn = kết thúc + 7 ngày) → `INSERT activity_logs`
   - `notify(EVENT_ASSIGNED)` → 2 dòng `notifications` cho Minh và An → push provider (log hoặc Expo)
   - Trả `201 { event }` qua `presentEventDetail`
3. **Web**: lưu lời nhắn vào `sessionStorage` → chuyển `/bch/events` → hiện banner "Đã tạo sự kiện và phân công task".
4. **Điện thoại của Minh**: trong ≤ 30 giây (polling) hoặc ngay lập tức (push thật) → banner "Bạn được phân công sự kiện mới" → bấm vào → mở chi tiết.
5. **Từ 3 ngày trước sự kiện, 09:00 mỗi sáng**: bản tin của Minh và An có thêm dòng "Phân công chụp ảnh · Xác nhận chụp ảnh" (push + email), lặp lại mỗi ngày cho tới khi một người trong nhóm bấm "Đánh dấu hoàn thành" (`PATCH /tasks/:id {status:'COMPLETED'}`), lúc đó task có `completed_at`, BCH nhận thông báo "Đã hoàn thành", và nếu mọi task xong thì sự kiện tự chuyển "Hoàn thành".

---

## 9. Kiểm thử

| Loại | Lệnh | Kiểm tra gì |
|---|---|---|
| Kiểu TypeScript | `npm run typecheck` (gốc) | Sai tên field, sai kiểu… ở cả 3 app |
| Smoke test API | `npm run smoke` (API đang chạy + vừa seed) | 31 tình huống: đăng ký sai role bị chặn, BTT không sửa được hạn, BCH không sửa sự kiện đã diễn ra, hạn recap +7 ngày, bản tin không gửi trùng, endpoint cron chặn khi sai bí mật… |
| Build web | `npm --prefix apps/web run build` | Next.js biên dịch được toàn bộ trang |
| Thử bằng tay | Đăng nhập 3 tài khoản demo | Trải nghiệm từng vai trò |

Trong quá trình làm, mình còn dùng **Playwright** (trình duyệt tự động) để chụp màn hình từng trang ở 1440px và 375px so với Figma, và chạy kịch bản: BCH tạo sự kiện → BTT thấy thông báo → BTT hoàn thành task.

📂 Đọc `apps/api/src/scripts/smoke.ts` để thấy cách viết test gọi API thật.

---

## 10. Sự cố gặp phải & cách xử lý

| Sự cố | Nguyên nhân | Cách xử lý |
|---|---|---|
| `npm install` báo 403 | Môi trường làm việc chặn mạng tới npm | Bạn mở quyền trong Settings → Capabilities |
| Prisma không tải được "engine" (`binaries.prisma.sh` 403) | Prisma 5/6 cần tải engine Rust riêng | Chuyển sang **Prisma 7 + driver adapter `pg`**, không cần engine (cũng là cách Prisma khuyên dùng). Trên máy bạn không gặp lỗi này. |
| `prisma generate` lỗi khi chưa có `.env` | `env('DATABASE_URL')` ném lỗi nếu thiếu biến | `prisma.config.ts` dùng `process.env.DATABASE_URL ?? ''` |
| Lỗi trùng email trả về chung chung | Với driver adapter, tên cột nằm sâu trong `err.meta` | `error.ts` tìm "email"/"username" trong toàn bộ `JSON.stringify(err.meta)` |
| Bảng task Admin hiện task đã xong lên đầu | Chỉ sắp theo hạn chót | Sắp `completed_at NULLS FIRST` rồi mới theo hạn chót |
| Web gọi API bị chặn CORS khi chạy bản web của Expo (cổng 8081) | API chỉ cho phép `localhost:3000` | Thêm `http://localhost:8081` vào `CORS_ORIGINS` |
| Nút "Chi tiết" bị xuống dòng | Chữ dài trong nút hẹp | Thêm `whitespace-nowrap` vào Button |

---

## 11. Các quyết định thiết kế & đánh đổi

| Quyết định | Lý do | Đánh đổi / Khi nào nên đổi |
|---|---|---|
| SQL tay là nguồn sự thật, Prisma `db pull` | Theo CLAUDE.md; học SQL thật; dùng trigger/partial index | Không có lịch sử migration tự động → dự án lớn nên dùng `prisma migrate` hoặc công cụ migration SQL (VD: dbmate) |
| Token JWT lưu `localStorage` (web) | Đơn giản, dễ hiểu | Dễ bị đánh cắp nếu trang có lỗi XSS → bản production nên dùng cookie `httpOnly` |
| Web là SPA client-side | Đã có API riêng; dễ học | Không tận dụng Server Components / SEO (app nội bộ nên không cần SEO) |
| Không dùng npm workspaces | Tránh xung đột phiên bản React giữa Next và RN | `types.ts`, `format.ts` bị **chép 2 nơi** → có thể tách thành package `packages/shared` |
| "Quá hạn" tính khi đọc, không lưu | Luôn đúng theo thời gian | Mỗi lần đọc phải tính; lọc "quá hạn" phải viết điều kiện SQL tương ứng |
| Cron chạy trong process API | Đơn giản, không cần dịch vụ phụ | Nếu chạy **nhiều bản API** cùng lúc sẽ chạy job nhiều lần (đã chống trùng bằng unique index, nhưng tốn tài nguyên) → nên tách worker hoặc dùng cron của nền tảng deploy |
| Polling 30 giây cho chuông thông báo | Không cần WebSocket | Trễ tối đa 30 giây; app lớn dùng WebSocket/SSE |
| Email qua Resend, mặc định `log` khi chạy local | Không cần SMTP; Render Free chặn cổng SMTP nhưng Resend đi HTTPS | Gửi cho người ngoài cần xác minh tên miền trên Resend |
| Task giao cho cả nhóm, không cho từng người | Đúng yêu cầu: BTT chỉ cần biết sự kiện mình đảm nhận | Không biết ai "chịu trách nhiệm" từng ấn phẩm → bù lại bằng `completed_by` và nhật ký hoạt động |
| Bản tin chạy ở 4 nơi (cron trong API, gửi bù, GitHub Actions, nút Admin) | Render Free có thể "ngủ" lúc 09:00 | Phải chống trùng chặt ở DB (unique index) |

---

## 12. Bài tập tự luyện

Làm theo thứ tự độ khó tăng dần. Mỗi bài chạm đủ 3 tầng DB → API → giao diện.

1. **(Dễ)** Thêm ấn phẩm mới **"Poster"** (bắt buộc kích thước).
   *Gợi ý:* thêm vào enum `task_type` trong `schema.sql` → `prisma db pull && prisma generate` → `DELIVERABLE_TYPES`, `DIMENSIONS_REQUIRED`, `TASK_TYPE_LABEL` ở API → `DELIVERABLES`, `DIM_REQUIRED` ở `EventForm.tsx` (web) và `event-form.tsx` (mobile).
2. **(Dễ)** Cho BTT ghi **ghi chú** khi đổi trạng thái task (hiện BTT chỉ đổi được `status`, `progress`).
3. **(Vừa)** Thêm bộ lọc **"Theo sự kiện"** ở trang Quản lý task của Admin (API đã hỗ trợ `?eventId=`).
4. **(Vừa)** Cho mỗi người **tự chọn giờ nhận bản tin** (thêm cột `digest_hour` vào `users`, cron chạy mỗi giờ và lọc theo cột này).
5. **(Vừa)** Cho phép sự kiện **nhiều ngày** (ngày kết thúc khác ngày bắt đầu) trong form.
6. **(Khó)** Tách `types.ts` + `format.ts` thành package dùng chung `packages/shared`.
7. **(Khó)** Bật **push thật** trên điện thoại của bạn theo README mục "Push thật".
8. **(Khó)** Thay polling bằng **Server-Sent Events** để chuông cập nhật tức thì.

---

## 13. Từ điển thuật ngữ

| Thuật ngữ | Nghĩa ngắn gọn |
|---|---|
| **API / REST** | Giao tiếp giữa client và server qua HTTP: `GET` đọc, `POST` tạo, `PUT/PATCH` sửa, `DELETE` xoá |
| **JSON** | Định dạng dữ liệu dạng văn bản `{ "key": "value" }` |
| **ORM** (Prisma) | Thư viện cho phép thao tác DB bằng code JS/TS thay vì viết SQL |
| **JWT** | "Vé" đã ký số chứa id + vai trò người dùng; server kiểm tra chữ ký thay vì lưu phiên |
| **bcrypt** | Thuật toán băm mật khẩu chậm có chủ đích để chống dò mật khẩu |
| **Middleware** | Hàm chạy chen giữa request và handler (VD: kiểm tra đăng nhập) |
| **Transaction** | Nhóm lệnh DB "tất cả hoặc không gì cả" |
| **CORS** | Cơ chế trình duyệt chặn web ở domain A gọi API ở domain B trừ khi B cho phép |
| **Cron** | Lịch chạy định kỳ, VD `0 9 * * *` = 09:00 mỗi ngày |
| **Hook** (React) | Hàm `useXxx` cho component có trạng thái / tác dụng phụ |
| **Context** (React) | Chia sẻ dữ liệu (VD user đăng nhập) cho mọi component mà không truyền props qua từng tầng |
| **SPA** | Ứng dụng một trang: trình duyệt tải một lần, sau đó tự vẽ lại bằng JS |
| **Expo Go** | App có sẵn trên store để chạy thử dự án Expo bằng cách quét QR |
| **Development build** | Bản app riêng của bạn (build bằng EAS) có đủ module native, cần cho push thật |
| **EAS** | Dịch vụ build/submit app trên cloud của Expo |
| **Expo Push Token** | Mã định danh thiết bị để Expo biết gửi thông báo tới máy nào |
| **Polling** | Hỏi server định kỳ "có gì mới không?" |
| **Design token** | Giá trị thiết kế đặt tên (màu, font, khoảng cách) dùng thống nhất ở mọi nơi |

---

## 14. Vòng 2 — Chỉnh sửa theo phản hồi

Sau khi dùng thử, bạn yêu cầu 6 thay đổi. Phần này ghi lại cách xử lý từng yêu cầu, cũng là ví dụ về việc **sửa một hệ thống đang chạy** xuyên suốt DB → API → web → mobile.

### 14.1. Bỏ "giao task cho từng người"

**Yêu cầu:** đưa phần phân công BTT vào *Thông tin chung*; ấn phẩm không cần giao cho ai; BTT chỉ nhận thông tin sự kiện mình đảm nhận.

| Tầng | Thay đổi |
|---|---|
| DB (`schema.sql`) | Bỏ cột `tasks.assignee_id`; thêm `tasks.completed_by` (ai bấm hoàn thành, để vẫn biết "ai đã làm") |
| API | Bỏ `assigneeId`, `photographerAssigneeId`, `recapAssigneeId` khỏi zod schema; người nhận thông báo = **mọi** `event_members`; `presentTask` trả `completedBy` |
| Web/Mobile | Ô "Ban Truyền thông phụ trách" chuyển vào mục 01 (`MemberPicker`); bỏ ô "Giao cho" ở từng ấn phẩm; Admin chỉ xem nhóm BTT của sự kiện |

> 📌 **Bài học:** xoá một cột là thay đổi "phá vỡ" (breaking change). Thứ tự an toàn: sửa DB → `prisma db pull && prisma generate` → **TypeScript sẽ báo đỏ mọi chỗ còn dùng `assigneeId`** → sửa lần lượt tới khi `npm run typecheck` sạch. Đây là lợi ích lớn nhất của việc dùng TypeScript cho cả 3 app.

### 14.2. Bản tin 09:00 gộp mọi task: push + email (Resend)

**Yêu cầu:** gộp toàn bộ task còn lại, thông báo trên điện thoại và gửi mail lúc 9 giờ sáng hằng ngày.

- Bỏ 3 loại nhắc riêng lẻ (`PHOTO_REMINDER`, `RECAP_REMINDER`, `DEADLINE_ALERT`) → 1 loại `DAILY_DIGEST`. Chi tiết ở **mục 7.1**.
- Thêm **email provider** (`apps/api/src/email/`) theo đúng khuôn của push provider. Đây là lợi ích của mẫu Strategy: thêm kênh mới không phải sửa code nghiệp vụ.
- Email HTML viết bằng **inline style** và bảng đơn giản vì nhiều ứng dụng email (Gmail, Outlook) bỏ qua thẻ `<style>`. Mọi dữ liệu người dùng nhập đều qua hàm `esc()` để chống chèn HTML.
- Unique index đổi thành `(recipient_id, type, reminder_date)` → mỗi người 1 bản tin/ngày.

### 14.3. Con trỏ "bàn tay" khi trỏ vào nút

Tailwind CSS v4 **đổi mặc định**: `<button>` dùng `cursor: default` như trình duyệt (v3 trước đây là `pointer`). Sửa một lần trong `globals.css` (`@layer base`): mọi `button`, `[role=button]`, `a`, `summary`, checkbox… đều `cursor: pointer`; nút bị vô hiệu hoá thì `not-allowed`.

### 14.4. Chuyển tab không còn "khựng"

**Web:** mỗi lần đổi trang, `useApi` cũ tải lại từ đầu và hiện "Đang tải...". Giờ `useApi` có **bộ nhớ đệm** kiểu *stale-while-revalidate*: hiện ngay dữ liệu lần trước, âm thầm tải bản mới rồi cập nhật (📂 `apps/web/src/lib/useApi.ts`). Đổi tab giờ gần như tức thì.

**Mobile:** mỗi tab là một màn riêng trong `Stack`, `router.replace` huỷ màn cũ và dựng màn mới. Cách xử lý (đúng như bạn gợi ý: *"cho vô chung 1 màn hình"*):
- Một route duy nhất `(app)/home.tsx` chứa header và hàng tab của vai trò.
- Nội dung từng tab là component trong `src/screens/`. Tab nào đã mở thì **giữ nguyên trong bộ nhớ**, chỉ ẩn/hiện bằng `display: 'none'`, nên vị trí cuộn và dữ liệu đang nhập dở được giữ lại.
- Tab đang chọn lưu ở `lib/workspace.ts` (biến ngoài React + `useSyncExternalStore`), nên mọi nơi gọi được `openTab('btt/reminders')`, kể cả khi bấm vào push.
- `useOnTabActive(reload)`: mở lại tab hoặc quay về từ màn chi tiết thì tải lại ngầm.

> 🐛 **Sự cố khi làm:** lần đầu mình thử navigator `Tabs` có sẵn của Expo Router (cách "chuẩn"). Kiểm tra kiểu và build đều qua, nhưng khi chạy thật thì **màn hình trắng trơn**, kể cả với `<Tabs />` trống không. Có thể do thay đổi trong phiên bản SDK 58. Thay vì tốn thời gian gỡ lỗi thư viện, mình chuyển sang cách tự quản lý ở trên: ít phụ thuộc hơn, dễ hiểu hơn. **Bài học:** "build thành công" chưa phải "chạy đúng"; luôn mở app lên thử thật.

### 14.5. Bộ chọn ngày, giờ, dropdown tự thiết kế

Ô `<input type="date">`, `<select>` mặc định trông khác nhau trên mỗi trình duyệt và hệ điều hành, không theo được Figma. Giờ tự vẽ:

| Thành phần | Web (`components/pickers.tsx`) | Mobile (`components/pickers.tsx`) |
|---|---|---|
| `DatePicker` | Popover lịch tháng tiếng Việt (T2…CN), khoá ngày đã qua, nút "Hôm nay" | Bottom sheet cùng giao diện |
| `TimePicker` | Mốc nhanh (08:00, 09:00…) + 2 cột giờ/phút | Như web |
| `Dropdown` | Danh sách có dấu ✓, điều khiển được bằng bàn phím | Bottom sheet |
| `MemberPicker` | Chọn nhiều BTT, ô tìm kiếm, hiện chip tên | Như web |

Kỹ thuật web đáng chú ý: đóng popover khi **bấm ra ngoài** (lắng nghe `mousedown` trên `document`) hoặc **phím Esc**, và đặt `role="dialog"` / `aria-*` cho trình đọc màn hình.

### 14.6. Chuẩn bị deploy

- **RLS** bật trên mọi bảng (`schema.sql` cuối file): Supabase mở schema `public` ra API công khai, bật RLS mà không có policy thì khoá công khai không đọc được gì.
- `seed.sql` thêm `SET search_path TO public, extensions` vì Supabase cài `pgcrypto` trong schema `extensions`.
- `apps/mobile/eas.json`: 3 profile `development`, `preview` (file `.apk`), `production` (TestFlight / Google Play).
- `.github/workflows/daily-digest.yml`: gọi bản tin lúc 09:00 giờ VN.
- Hướng dẫn đầy đủ: **DEPLOY.md**.

### 14.7. Cập nhật DB local sau vòng 2

Cấu trúc bảng đã đổi nên DB cũ trên máy bạn phải tạo lại:
```bash
npm run db:reset                         # (thư mục gốc) schema.sql + seed.sql
cd apps/api && npm install && npm run dev # npm install chạy lại prisma generate
```

---

## 15. Vòng 3 — iPhone nhận thông báo miễn phí: PWA + Web Push

**Bối cảnh:** muốn cài app iOS (TestFlight) phải trả 99 USD/năm cho Apple Developer Program. Các cách miễn phí như Xcode hay SideStore đều hết hạn sau 7 ngày và **không có push**. Giải pháp: biến web thành **PWA** (Progressive Web App). Từ iOS 16.4, Apple cho web app đã "Thêm vào MH chính" nhận **Web Push**, miễn phí và không hết hạn.

### 15.1. Ba thành phần của một PWA có thông báo

| Thành phần | File | Vai trò |
|---|---|---|
| Manifest | `apps/web/src/app/manifest.ts` | Tên, icon, màu, `display: standalone` → mở toàn màn hình như app |
| Icon | `scripts/make-icons.mjs` → `public/icons/*`, `src/app/apple-icon.png` | Icon trên màn hình chính (iPhone dùng `apple-icon` 180×180) |
| Service worker | `apps/web/public/sw.js` | Đoạn JS chạy **nền**, kể cả khi đã đóng app: nhận push → hiện thông báo → bấm vào thì mở đúng trang |

### 15.2. Luồng Web Push từ đầu tới cuối

```
 iPhone (web app)                 API (Render)                  Apple Push Service
 ────────────────                 ────────────                  ──────────────────
 1. Bấm "Bật thông báo"
    Notification.requestPermission()
 2. pushManager.subscribe(VAPID public key) ─────────────────────────► cấp endpoint
    ◄──────────────────────────────────────────────────────── endpoint + p256dh + auth
 3. POST /api/push/web/subscriptions ─►  lưu web_push_subscriptions
                                        ...
                                  4. 09:00: notify() → sendWebPush()
                                     - mã hoá nội dung bằng p256dh/auth
                                     - ký bằng VAPID private key
                                     POST endpoint ───────────────────►
 5. sw.js nhận sự kiện 'push' ◄──────────────────────────────────────── chuyển tới máy
    showNotification(title, body)
 6. Bấm thông báo → 'notificationclick' → mở /btt/reminders
```

Hai điểm cần hiểu:
- **Mã hoá đầu-cuối:** nội dung được mã hoá bằng khoá của *chính thiết bị* (p256dh, auth), nên Apple/Google chỉ chuyển đi mà **không đọc được** nội dung.
- **VAPID** ("Voluntary Application Server Identification"): API ký mỗi lần gửi bằng khoá *private*; trình duyệt chỉ chấp nhận push được ký bởi khoá *public* đã dùng lúc đăng ký. Kẻ khác có endpoint cũng không gửi được.

### 15.3. Các file thay đổi

| Tầng | Thay đổi |
|---|---|
| DB | Bảng `web_push_subscriptions` (`schema.sql`); DB đã có dữ liệu thì chạy `db/migrations/001_web_push.sql` |
| API | `push/webpush.ts` (thư viện `web-push`); `notify()` gửi **cả** Web Push (iPhone/trình duyệt) **và** Expo Push (app `.apk`); endpoint `GET /push/web/public-key`, `POST/DELETE /push/web/subscriptions`, `POST /push/web/test`; tự xoá đăng ký khi nhận lỗi 404/410 (người dùng đã gỡ app) |
| Web | `lib/webpush.ts` (bật/tắt/gửi thử, phát hiện iPhone chưa cài); `components/PushPrompt.tsx` (dải nhắc ở đầu trang + thẻ cài đặt ở trang Thông báo); `layout.tsx` (thẻ meta cho iOS, `viewport-fit: cover` + chừa "tai thỏ" bằng `env(safe-area-inset-top)`); đăng xuất thì gỡ đăng ký của máy đó |

### 15.4. Những quy tắc riêng của iPhone

1. Chỉ web app **mở từ icon trên màn hình chính** mới có `PushManager`. Mở trong Safari thường thì không, nên `getPushState()` trả về `ios-install` để hiện hướng dẫn cài.
2. Phải xin quyền **ngay sau một cú bấm** của người dùng (không được tự hỏi lúc mở trang), nên ta có nút "Bật thông báo".
3. Bắt buộc **HTTPS**. Vercel có sẵn; còn chạy local thì chỉ trình duyệt máy tính thử được (`localhost` được coi là an toàn).
4. Mọi push **phải hiện thông báo** (`userVisibleOnly: true`), không được push "im lặng".

### 15.5. Kiểm thử đã làm

- **API:** giả lập một "thiết bị" bằng máy chủ HTTPS cục bộ có khoá ECDH riêng. Bấm Gửi thử và chạy bản tin 09:00 → máy chủ giả nhận được, **giải mã ra đúng nội dung**. Trả về 410 → API tự xoá đăng ký.
- **Service worker:** dùng Chrome DevTools Protocol (`ServiceWorker.deliverPushMessage`) đẩy một tin vào → thông báo hiện đúng tiêu đề, nội dung, icon, link.
- **Giao diện:** giả lập iPhone chưa cài → hiện hướng dẫn "Thêm vào MH chính". Ở trình duyệt có hỗ trợ: Bật → Gửi thử → Tắt đều chạy đúng.
- **Smoke test:** 35/35.

> 📌 **Bài học kiến trúc:** nhờ mọi thông báo đều đi qua một hàm `notify()` (mục 7.2), thêm cả một kênh mới (Web Push) **không phải sửa** logic bản tin, nhắc việc hay phân công.

---

## 16. Vòng 4 — Sự cố sau deploy: bản tin tới lúc 14:28, không thấy "đăng recap"

### 16.1. Bản tin tới trễ 5 tiếng: lỗi ở lịch của GitHub
- Lịch `schedule` của GitHub Actions chạy theo kiểu **best-effort**. Giờ cao điểm (nhất là phút 0 của mỗi giờ), job bị xếp hàng, thường trễ từ vài phút tới vài giờ, có hôm bị bỏ qua. Lịch `0 2 * * *` chạy thực tế lúc 07:03 và 07:28 UTC.
- Render Free đang ngủ lúc 09:00 nên `node-cron` trong API không chạy. Khi GitHub đánh thức lúc 14:28, `catchUpDigest()` thấy đã quá 09:00 nên gửi bù luôn. Vì vậy giờ gửi trùng với giờ GitHub chạy.
- **Bài học:** muốn đúng giờ thì cần một bộ hẹn giờ có cam kết về độ chính xác, như cron-job.org hoặc pg_cron của Supabase, hoặc giữ server luôn thức. Hệ thống được thiết kế **idempotent** (chạy nhiều lần cũng không sao, nhờ unique index), nên có thể dùng **nhiều bộ hẹn giờ cùng lúc**: một cái chính, một cái dự phòng.

### 16.2. "Không nhận được thông báo đăng recap"
Có 3 nguyên nhân cộng lại:
1. Recap **không phải thông báo riêng**. Nó là một dòng trong bản tin gộp ("… · đăng recap: <sự kiện>").
2. Trước đây recap chỉ vào bản tin **từ ngày hôm sau** sự kiện. Đã đổi thành **ngay khi sự kiện kết thúc** (`now >= endsAt`), đúng yêu cầu ban đầu.
3. Mỗi người chỉ có 1 bản tin/ngày. Nếu bản tin được tạo khi điện thoại chưa bật thông báo, nó nằm trong hộp thư app nhưng không bao giờ được đẩy lên điện thoại. Cách sửa: `redeliverDigest()`. Lần chạy sau, bản tin hôm nay có `push_sent_at IS NULL` sẽ được cập nhật nội dung mới nhất rồi đẩy lại. Email chỉ gửi nếu chưa gửi (`email_sent_at`).

### 16.3. Chẩn đoán push tốt hơn
`sendWebPush()` giờ trả thêm `errors` (mã HTTP + nội dung lỗi từ máy chủ push của Apple/Google). Nút **Gửi thử** hiện lý do cụ thể:
- Không có đăng ký trên máy chủ → tự gỡ ở trình duyệt, nhắc bấm **Bật** lại.
- `403` → thường do khoá VAPID khác với lúc đăng ký.
- `410` → đăng ký hết hạn (đã gỡ icon).

Cách kiểm tra trên Supabase (SQL Editor):
```sql
select u.username, count(w.*) as thiet_bi from users u left join web_push_subscriptions w on w.user_id = u.id group by 1;
select recipient_id, title, body, created_at, push_sent_at, email_sent_at from notifications
where type = 'DAILY_DIGEST' order by created_at desc limit 10;
```
