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

---

## 1. Bức tranh tổng thể

### 1.1. App làm gì?

Một tổ chức (VD: Đoàn – Hội khoa CSE) tổ chức nhiều sự kiện. Mỗi sự kiện cần nhiều **ấn phẩm truyền thông** (banner, backdrop, standee…), cần **người chụp ảnh** và cần **bài recap** sau sự kiện.

| Vai trò | Làm gì |
|---|---|
| **Admin** | Quản lý tài khoản (tạo, sửa, đổi vai trò), xem và chỉnh mọi task |
| **BCH** (Ban Chấp hành) | Tạo sự kiện, chọn ấn phẩm, **chọn BTT phụ trách**, sửa sự kiện (nếu chưa diễn ra), bấm "Nhắc" từng task |
| **BTT** (Ban Truyền thông) | Xem sự kiện được giao, đổi trạng thái task, nhận nhắc nhở tự động hằng ngày |

Nhắc nhở tự động (mỗi ngày lúc 08:00, cho tới khi task hoàn thành):
- **Phân công chụp ảnh**: bắt đầu từ 3 ngày trước sự kiện.
- **Recap sự kiện**: bắt đầu từ ngày hôm sau sự kiện (hạn recap = kết thúc + 7 ngày).

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
users 1 ───< tasks (assignee_id)           một BTT nhận nhiều task
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
│   └── notifications.ts  /api/notifications, /api/reminders, /api/push-tokens
├── services/         ← logic nghiệp vụ dùng lại ở nhiều route
│   ├── presenters.ts ← DB record → JSON (+ trường tính toán)
│   ├── eventAccess.ts← ai được xem/sửa sự kiện nào
│   ├── notify.ts     ← tạo thông báo + đẩy push
│   └── reminders.ts  ← job nhắc nhở hằng ngày
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
| POST | `/api/admin/run-reminders` | Admin | Chạy job nhắc nhở ngay (demo) |

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
| Người nhận task phải nằm trong nhóm BTT đã chọn | `eventSchema.superRefine` |
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

- **Mục 05 "Phân công Ban Truyền thông"** trong form sự kiện: chọn nhiều BTT; mỗi ấn phẩm có ô "Giao cho" lấy từ nhóm đã chọn; chọn người phụ trách recap.
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
    ├── _layout.tsx       ← chặn chưa đăng nhập; header navy cho mọi màn con
    ├── admin/accounts.tsx, admin/tasks.tsx
    ├── bch/events.tsx, bch/event-form.tsx
    ├── btt/events.tsx, btt/reminders.tsx
    ├── events/[id].tsx
    └── notifications.tsx
```
Chuyển màn: `router.push('/events/3')`, quay lại: `router.back()`, thay màn hiện tại: `router.replace(...)`.

### 6.3. Những điểm riêng của mobile

- **Địa chỉ API tự động** (`lib/api.ts`): điện thoại không hiểu `localhost` là máy Mac của bạn. App đọc `Constants.expoConfig.hostUri` (IP của máy chạy `expo start`) rồi ghép `:4000/api`. Muốn chỉ định thì đặt `EXPO_PUBLIC_API_URL`.
- **Giờ VN tự tính** (`lib/format.ts`): engine JavaScript Hermes trên điện thoại có thể thiếu dữ liệu múi giờ, nên bản mobile tự cộng 7 giờ thay vì dùng `Intl` như web.
- **Chọn ngày giờ**: `DateTimeField.tsx` dùng `@react-native-community/datetimepicker`; file `DateTimeField.web.tsx` là bản thay thế khi chạy trên trình duyệt. Metro (bundler của RN) **tự chọn file `.web.tsx`** khi build web, đây gọi là *platform-specific extensions*.
- **Kéo để làm mới**: `<ScrollView refreshControl={<RefreshControl .../>}>` trong `components/ui.tsx` → `Screen`.
- **Dropdown**: React Native không có `<select>`, nên `Select` trong `ui.tsx` tự làm bằng `Modal` dạng bottom sheet.

---

## 7. Hệ thống thông báo & nhắc nhở

Đây là phần "khó" nhất, thiết kế để **demo được ngay** mà **sau này bật push thật không cần sửa code**.

### 7.1. Job nhắc nhở hằng ngày

📂 `apps/api/src/services/reminders.ts`, `src/index.ts`

```ts
cron.schedule('0 8 * * *', runDailyReminders, { timezone: 'Asia/Ho_Chi_Minh' });
```
Mỗi sáng 08:00 (và một lần khi API khởi động), job quét các task **chưa xong** của sự kiện **đã gửi**:

| Task | Điều kiện gửi nhắc | Loại |
|---|---|---|
| Phân công chụp ảnh | hôm nay ≥ ngày sự kiện − 3 | `PHOTO_REMINDER` |
| Recap sự kiện | hôm nay ≥ ngày sau ngày kết thúc | `RECAP_REMINDER` |
| Ấn phẩm khác | hạn chót trong 48 giờ tới | `DEADLINE_ALERT` |

So sánh **theo ngày lịch Việt Nam** (`lib/time.ts → vnDayDiff`), không theo số giờ, vì "3 ngày trước sự kiện" là theo lịch chứ không phải đúng 72 giờ.

**Chống trùng**: mỗi thông báo lưu `reminder_date` = hôm nay. Unique index (mục 3.2f) + `createManyAndReturn({ skipDuplicates: true })` (tức `INSERT ... ON CONFLICT DO NOTHING`) đảm bảo mỗi ngày chỉ một lần.

### 7.2. Một đường ống duy nhất cho mọi thông báo

📂 `apps/api/src/services/notify.ts`

```
notify({ recipientIds, type, title, body, ... })
   ├─ 1. INSERT vào bảng notifications   → hiện ở chuông web + màn Thông báo
   └─ 2. getPushProvider().send(...)      → đẩy tới điện thoại (nếu có token)
```
Dù là nhắc tự động, BCH bấm "Nhắc", hay BTT được phân công, **tất cả** đều gọi `notify()`.

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
5. **3 ngày trước sự kiện, 08:00**: cron → `PHOTO_REMINDER` cho người phụ trách chụp ảnh, mỗi ngày một lần cho tới khi bấm "Đánh dấu hoàn thành" (`PATCH /tasks/:id {status:'COMPLETED'}`), lúc đó task có `completed_at`, BCH nhận thông báo "Đã hoàn thành", và nếu mọi task xong thì sự kiện tự chuyển "Hoàn thành".

---

## 9. Kiểm thử

| Loại | Lệnh | Kiểm tra gì |
|---|---|---|
| Kiểu TypeScript | `npm run typecheck` (gốc) | Sai tên field, sai kiểu… ở cả 3 app |
| Smoke test API | `npm run smoke` (API đang chạy + vừa seed) | 29 tình huống: đăng ký sai role bị chặn, BTT không sửa được hạn, BCH không sửa sự kiện đã diễn ra, hạn recap +7 ngày, job nhắc không tạo trùng… |
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
| Email chưa gửi thật (chỉ log) | Cần tài khoản SMTP | Tích hợp Resend/SendGrid ở `routes/users.ts` |

---

## 12. Bài tập tự luyện

Làm theo thứ tự độ khó tăng dần. Mỗi bài chạm đủ 3 tầng DB → API → giao diện.

1. **(Dễ)** Thêm ấn phẩm mới **"Poster"** (bắt buộc kích thước).
   *Gợi ý:* thêm vào enum `task_type` trong `schema.sql` → `prisma db pull && prisma generate` → `DELIVERABLE_TYPES`, `DIMENSIONS_REQUIRED`, `TASK_TYPE_LABEL` ở API → `DELIVERABLES`, `DIM_REQUIRED` ở `EventForm.tsx` (web) và `event-form.tsx` (mobile).
2. **(Dễ)** Cho BTT ghi **ghi chú** khi đổi trạng thái task (hiện BTT chỉ đổi được `status`, `progress`).
3. **(Vừa)** Thêm bộ lọc **"Theo sự kiện"** ở trang Quản lý task của Admin (API đã hỗ trợ `?eventId=`).
4. **(Vừa)** Gửi **email thật** khi Admin tạo tài khoản (dùng Resend, viết theo kiểu "provider" giống `push/index.ts`).
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
| **Cron** | Lịch chạy định kỳ, VD `0 8 * * *` = 08:00 mỗi ngày |
| **Hook** (React) | Hàm `useXxx` cho component có trạng thái / tác dụng phụ |
| **Context** (React) | Chia sẻ dữ liệu (VD user đăng nhập) cho mọi component mà không truyền props qua từng tầng |
| **SPA** | Ứng dụng một trang: trình duyệt tải một lần, sau đó tự vẽ lại bằng JS |
| **Expo Go** | App có sẵn trên store để chạy thử dự án Expo bằng cách quét QR |
| **Development build** | Bản app riêng của bạn (build bằng EAS) có đủ module native, cần cho push thật |
| **EAS** | Dịch vụ build/submit app trên cloud của Expo |
| **Expo Push Token** | Mã định danh thiết bị để Expo biết gửi thông báo tới máy nào |
| **Polling** | Hỏi server định kỳ "có gì mới không?" |
| **Design token** | Giá trị thiết kế đặt tên (màu, font, khoảng cách) dùng thống nhất ở mọi nơi |
