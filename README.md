# CSE Task Manage

Quản lý công việc cho từng sự kiện: **BCH** tạo sự kiện và phân công cho **BTT**, BTT theo dõi task và nhận **bản tin 09:00 mỗi sáng** (gộp mọi việc còn lại, gửi lên điện thoại + email), **Admin** quản lý tài khoản và toàn bộ task.

| Thành phần | Công nghệ | Thư mục | Cổng mặc định |
|---|---|---|---|
| Cơ sở dữ liệu | PostgreSQL 16 (Homebrew) | `db/` | 5432 |
| API | Node.js + Express 5 + Prisma 7 | `apps/api` | 4000 |
| Web | Next.js 16 + Tailwind CSS 4 | `apps/web` | 3000 |
| Mobile | Expo SDK 58 + Expo Router | `apps/mobile` | 8081 (Metro) |

> 📘 Muốn hiểu dự án được dựng như thế nào? Đọc **[STUDY.md](./STUDY.md)**.
> 🚀 Đưa lên mạng (Supabase, Render, Vercel, Resend), cài lên iPhone như app và nhận thông báo: đọc **[DEPLOY.md](./DEPLOY.md)**.

---

## Mục lục

- [1. Chạy local](#1-chạy-local)
  - [1.1. Cài công cụ](#11-cài-công-cụ-một-lần)
  - [1.2. Tạo và nạp cơ sở dữ liệu](#12-tạo-và-nạp-cơ-sở-dữ-liệu)
  - [1.3. Chạy API](#13-chạy-api)
  - [1.4. Chạy web](#14-chạy-web)
  - [1.5. Chạy app mobile](#15-chạy-app-mobile)
  - [1.6. Tài khoản demo](#16-tài-khoản-demo)
  - [1.7. Kiểm thử](#17-kiểm-thử)
- [2. Biến môi trường](#2-biến-môi-trường)
- [3. Thông báo & bản tin hằng ngày](#3-thông-báo--bản-tin-hằng-ngày)
- [4. Deploy](#4-deploy)
- [5. Lỗi thường gặp](#5-lỗi-thường-gặp)

---

## 1. Chạy local

### 1.1. Cài công cụ (một lần)

```bash
# Homebrew: https://brew.sh
brew install node@22 postgresql@16

# postgresql@16 là "keg-only": thêm psql vào PATH (Apple Silicon)
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
#  (Mac chip Intel: thay /opt/homebrew bằng /usr/local)

brew services start postgresql@16   # chạy Postgres nền, tự bật khi khởi động máy
psql --version                      # psql (PostgreSQL) 16.x
```

Trên điện thoại: cài app **Expo Go** (App Store / CH Play) nếu muốn chạy bản mobile.

### 1.2. Tạo và nạp cơ sở dữ liệu

```bash
cd "~/Code/CSE Task Manage"

createdb cse_task_manage

cd db                                           # BẮT BUỘC: \copy trong seed.sql dùng đường dẫn tương đối
psql -d cse_task_manage -f schema.sql           # tạo bảng (xoá sạch dữ liệu cũ nếu có!)
psql -d cse_task_manage -f seed.sql             # dữ liệu mẫu + in bảng kiểm tra
cd ..
```

Hoặc từ thư mục gốc: `npm run db:reset` (chạy cả 2 file).

Kiểm tra nhanh:
```bash
psql -d cse_task_manage -c "SELECT username, role FROM users;"
```

> Ngày sự kiện trong seed được tính **theo ngày hôm nay**, nên lúc nào nạp lại cũng có sẵn tình huống demo (sự kiện sắp diễn ra trong 3 ngày → nhắc chụp ảnh; sự kiện vừa kết thúc → nhắc recap). Nạp lại seed bất cứ lúc nào: `npm run db:seed`.

### 1.3. Chạy API

```bash
cd apps/api
cp .env.example .env
```
Mở `.env`, sửa `DATABASE_URL`. Với Postgres từ Homebrew, user là **tên đăng nhập macOS** (xem bằng lệnh `whoami`), không có mật khẩu:
```env
DATABASE_URL="postgresql://phongphanhai06@localhost:5432/cse_task_manage"
JWT_SECRET="<chạy: openssl rand -hex 32 rồi dán vào đây>"
```
Rồi:
```bash
npm install          # tự chạy "prisma generate" sinh Prisma Client
npm run dev          # http://localhost:4000/api  (tự reload khi sửa code)
```
Thấy dòng `✅ API chạy tại http://localhost:4000/api` là xong. Thử: `curl http://localhost:4000/api/health`.

**Khi sửa `db/schema.sql`**, đồng bộ lại Prisma:
```bash
npm run db:pull       # prisma db pull: đọc cấu trúc DB → cập nhật prisma/schema.prisma
npm run db:generate   # prisma generate: sinh lại client có kiểu TypeScript
```

### 1.4. Chạy web

Mở terminal mới:
```bash
cd apps/web
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                    # http://localhost:3000
```

### 1.5. Chạy app mobile

Mở terminal mới (API phải đang chạy):
```bash
cd apps/mobile
npm install
npx expo start
```
- **Điện thoại thật**: điện thoại và Mac **cùng mạng Wi-Fi** → mở Expo Go → quét mã QR. App tự dùng IP của Mac làm địa chỉ API (`http://<IP-Mac>:4000/api`).
- **Máy ảo iOS**: bấm `i` (cần Xcode). **Máy ảo Android**: bấm `a` (cần Android Studio).
- **Trình duyệt**: bấm `w` (http://localhost:8081).

Nếu app báo "Không kết nối được máy chủ": tạo `apps/mobile/.env` với `EXPO_PUBLIC_API_URL=http://<IP-Mac>:4000/api` (xem IP: `ipconfig getifaddr en0`), rồi chạy lại `npx expo start -c`.

### 1.6. Tài khoản demo

Mật khẩu của tất cả: **`matkhau123`**

| Username | Vai trò | Ghi chú |
|---|---|---|
| `linh.nguyen` | Admin | |
| `mai.anh` | BCH | đã tạo 5 sự kiện (đủ trạng thái: nháp, đang thực hiện, hoàn thành) |
| `thu.pham`, `hanh.do` | BCH | |
| `minh.tran` | BTT | có nhắc chụp ảnh + cảnh báo hạn chót |
| `an.vo` | BTT | có nhắc recap |
| `bao.le`, `duc.hoang` | BTT | |

Đăng nhập bằng username **hoặc** email (VD `mai.anh@cse.edu.vn`).

### 1.7. Kiểm thử

```bash
npm run typecheck           # (thư mục gốc) kiểm tra kiểu TypeScript cả 3 app
npm run db:seed && npm run smoke   # API phải đang chạy: 29 kiểm tra luồng nghiệp vụ
```

Gửi bản tin hằng ngày ngay (không chờ 09:00):
- Web hoặc app: đăng nhập Admin → **Quản lý task** → nút **Gửi bản tin ngay**
- hoặc dòng lệnh: `npm --prefix apps/api run digest:run`

Khi chạy local, push và email mặc định **chỉ in ra cửa sổ terminal của API** (`PUSH_PROVIDER=log`, `EMAIL_PROVIDER=log`), nên bạn đọc được nội dung bản tin ngay trong log.

### Script tiện ích ở thư mục gốc

| Lệnh | Làm gì |
|---|---|
| `npm run install:all` | `npm install` cho cả 3 app |
| `npm run db:reset` | Tạo lại bảng + nạp seed |
| `npm run db:seed` | Chỉ nạp lại dữ liệu mẫu |
| `npm run dev:api` / `dev:web` / `dev:mobile` | Chạy từng app |
| `npm run smoke` | Smoke test API |
| `npm run typecheck` | Kiểm tra kiểu cả 3 app |

---

## 2. Biến môi trường

Không commit file `.env` (đã có trong `.gitignore`). Mỗi app có `.env.example` làm mẫu.

**`apps/api/.env`**

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `DATABASE_URL` | ✅ | | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | ✅ | | Khoá ký token đăng nhập (chuỗi ngẫu nhiên dài) |
| `JWT_EXPIRES_IN` | | `7d` | Thời hạn token |
| `PORT` | | `4000` | Cổng API |
| `CORS_ORIGINS` | | `http://localhost:3000` | Các domain web được gọi API, cách nhau bởi dấu phẩy |
| `WEB_URL` | | `http://localhost:3000` | Địa chỉ web, dùng tạo link trong email |
| `DIGEST_CRON` | | `0 9 * * *` | Lịch gửi bản tin (giờ Việt Nam) |
| `DIGEST_HOUR` | | `9` | Giờ gửi; khởi động sau giờ này mà hôm nay chưa gửi thì gửi bù |
| `DIGEST_CATCH_UP_ON_START` | | `true` | Bật/tắt gửi bù khi khởi động |
| `CRON_SECRET` | | *(trống = tắt)* | Bí mật để dịch vụ hẹn giờ bên ngoài gọi `POST /api/cron/daily-digest` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | | *(trống = chỉ in console)* | Khoá Web Push cho iPhone/trình duyệt. Tạo: `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | | `mailto:admin@example.com` | Liên hệ người gửi (Apple yêu cầu) |
| `EMAIL_PROVIDER` | | `log` | `log` = in console; `resend` = gửi thật qua Resend |
| `RESEND_API_KEY` | | | API key Resend (`re_...`) |
| `EMAIL_FROM` | | `CSE Task Manage <onboarding@resend.dev>` | Người gửi; cần tên miền đã xác minh trên Resend để gửi cho mọi người |
| `PUSH_PROVIDER` | | `log` | Push cho app Android `.apk`: `log` = in console; `expo` = gửi thật |
| `EXPO_ACCESS_TOKEN` | | | Chỉ cần nếu bật "Enhanced Push Security" trên expo.dev |

**`apps/web/.env.local`**: `NEXT_PUBLIC_API_URL` (địa chỉ API).

**`apps/mobile/.env`**: `EXPO_PUBLIC_API_URL` (để trống = tự dùng IP máy chạy Expo).

---

## 3. Thông báo & bản tin hằng ngày

| Khi nào | Ai nhận | Kênh |
|---|---|---|
| BCH gửi sự kiện / thêm BTT | BTT được phân công | trong app + push |
| BCH bấm **Nhắc** ở một task | cả nhóm BTT của sự kiện | trong app + push |
| BTT hoàn thành task | BCH tạo sự kiện | trong app + push |
| **09:00 mỗi ngày** | mỗi BTT còn việc | **1** thông báo trong app + **1** push + **1** email, gộp mọi task chưa xong |

Bản tin 09:00 gộp mọi ấn phẩm chưa xong, việc **phân công chụp ảnh** (từ 3 ngày trước sự kiện) và **recap** (từ hôm sau sự kiện, hạn 7 ngày). Từng task được gắn cờ *Quá hạn / Trong 48 giờ / Xác nhận chụp ảnh / Cần đăng recap*. Gửi lặp lại mỗi ngày tới khi task được đánh dấu hoàn thành; DB đảm bảo mỗi người chỉ nhận 1 bản tin/ngày.

**Nhận thông báo trên điện thoại:**
- **iPhone / iPad**: mở web bằng Safari → **Chia sẻ → Thêm vào MH chính** → mở từ icon → **Bật thông báo**. Đây là Web Push, miễn phí, không cần tài khoản Apple Developer. Chi tiết: **DEPLOY.md mục 4**.
- **Android / máy tính**: Chrome, Edge hoặc Firefox → bấm **Bật thông báo** ngay trên web, hoặc cài thành app (⋮ → **Cài đặt ứng dụng**).
- **App Android `.apk`** (tuỳ chọn): dùng Expo Push, xem **DEPLOY.md mục 7**.

Thử Web Push khi chạy local: trình duyệt máy tính chấp nhận `http://localhost`. Đặt `VAPID_*` trong `apps/api/.env` → mở web bằng Chrome → **Thông báo → Bật thông báo → Gửi thử**. Còn iPhone bắt buộc phải là HTTPS, nên cần deploy lên Vercel trước.

---

## 4. Deploy

Xem **[DEPLOY.md](./DEPLOY.md)**: hướng dẫn từng bước với Supabase (DB), Render (API), Vercel (web), Resend (email), GitHub Actions (hẹn giờ 09:00), EAS (file `.apk` Android và TestFlight iOS).

---

## 5. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `psql: command not found` | Chưa thêm PostgreSQL vào PATH (mục 1.1) |
| `could not open file "data/users.csv"` | Chạy `seed.sql` khi **đang đứng trong thư mục `db/`** |
| `role "postgres" does not exist` | Homebrew dùng user = tên macOS; sửa `DATABASE_URL` theo `whoami` |
| API: `Thiếu biến môi trường DATABASE_URL` | Chưa tạo `apps/api/.env` từ `.env.example` |
| Web báo "Không kết nối được máy chủ" | API chưa chạy, hoặc `NEXT_PUBLIC_API_URL` sai |
| Web gọi API bị lỗi CORS | Thêm địa chỉ web vào `CORS_ORIGINS` rồi khởi động lại API |
| Điện thoại không gọi được API | Cùng Wi-Fi chưa? Tường lửa macOS (System Settings → Network → Firewall) có chặn Node không? Thử `EXPO_PUBLIC_API_URL=http://<IP-Mac>:4000/api` |
| Đổi `schema.sql` xong API lỗi kiểu dữ liệu | Chạy `npm run db:pull && npm run db:generate` trong `apps/api` |
| Đăng nhập xong bị bắt đổi mật khẩu | Tài khoản do Admin tạo với mật khẩu tạm; đổi một lần là xong |
