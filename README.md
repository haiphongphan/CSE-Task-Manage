# CSE Task Manage

Quản lý công việc cho từng sự kiện: **BCH** tạo sự kiện và phân công cho **BTT**, BTT theo dõi task và nhận **nhắc nhở hạn chót tự động**, **Admin** quản lý tài khoản và toàn bộ task.

| Thành phần | Công nghệ | Thư mục | Cổng mặc định |
|---|---|---|---|
| Cơ sở dữ liệu | PostgreSQL 16 (Homebrew) | `db/` | 5432 |
| API | Node.js + Express 5 + Prisma 7 | `apps/api` | 4000 |
| Web | Next.js 16 + Tailwind CSS 4 | `apps/web` | 3000 |
| Mobile | Expo SDK 58 + Expo Router | `apps/mobile` | 8081 (Metro) |

> 📘 Muốn hiểu dự án được dựng như thế nào? Đọc **[STUDY.md](./STUDY.md)**.

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
- [3. Thông báo đẩy (push) thật](#3-thông-báo-đẩy-push-thật)
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

Chạy job nhắc nhở ngay (không chờ 08:00):
- Web: đăng nhập Admin → **Quản lý task** → nút **Chạy nhắc nhở**
- hoặc dòng lệnh: `npm --prefix apps/api run reminders:run`

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
| `REMINDER_CRON` | | `0 8 * * *` | Lịch nhắc nhở (giờ Việt Nam) |
| `REMINDER_RUN_ON_START` | | `true` | Chạy nhắc nhở một lần khi khởi động |
| `PUSH_PROVIDER` | | `log` | `log` = in console; `expo` = gửi push thật |
| `EXPO_ACCESS_TOKEN` | | | Chỉ cần nếu bật "Enhanced Push Security" trên expo.dev |

**`apps/web/.env.local`**: `NEXT_PUBLIC_API_URL` (địa chỉ API).

**`apps/mobile/.env`**: `EXPO_PUBLIC_API_URL` (để trống = tự dùng IP máy chạy Expo).

---

## 3. Thông báo đẩy (push) thật

Mặc định app mobile chạy **chế độ demo**: khi app đang mở, cứ 30 giây hỏi API một lần và hiện thông báo trên máy. Để nhận thông báo **cả khi app đã tắt**, bật push thật như sau. **Không cần sửa code.**

1. **Tạo project trên Expo** (miễn phí):
   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest init        # tự ghi "extra.eas.projectId" vào app.json
   ```
2. **Cấu hình chứng chỉ push**:
   - Android: tạo project Firebase, tải service account key (FCM V1) rồi chạy `npx eas-cli@latest credentials` → Android → "Push Notifications: FCM V1". Hướng dẫn: https://docs.expo.dev/push-notifications/fcm-credentials/
   - iOS: cần tài khoản Apple Developer (trả phí); EAS tự tạo khoá push khi build.
3. **Build bản development** (Expo Go không hỗ trợ đủ push từ xa):
   ```bash
   npx eas-cli@latest build --profile development --platform android   # hoặc ios
   ```
   Cài file build lên điện thoại, chạy `npx expo start --dev-client`.
4. **Bật push ở API**: trong `apps/api/.env` đặt `PUSH_PROVIDER=expo`, khởi động lại API.
5. Đăng nhập trên app → app tự gửi Expo Push Token lên API (bảng `push_tokens`). Menu avatar sẽ ghi "Thông báo: Push thật (Expo)".

Thử: đăng nhập web bằng BCH → mở sự kiện → bấm **Nhắc** ở một task → điện thoại BTT nhận thông báo ngay.

---

## 4. Deploy

Gợi ý một cấu hình miễn phí / rẻ phổ biến:

```
Vercel (web)  ──►  Render / Railway (API)  ──►  Neon / Supabase (PostgreSQL)
EAS (mobile)  ──┘
```

### 4.1. Cơ sở dữ liệu (Neon hoặc Supabase)

1. Tạo database Postgres 16, copy **connection string** (dạng `postgresql://user:pass@host/db?sslmode=require`).
2. Nạp schema + dữ liệu từ máy bạn:
   ```bash
   cd db
   psql "<CONNECTION_STRING>" -f schema.sql
   psql "<CONNECTION_STRING>" -f seed.sql     # bỏ qua nếu không muốn dữ liệu mẫu
   ```
   (`pgcrypto` có sẵn trên Neon và Supabase.)
3. Với dữ liệu thật: **đổi mật khẩu tài khoản Admin** ngay sau khi deploy, hoặc tạo Admin riêng bằng SQL thay vì dùng seed.

### 4.2. API (Render)

Tạo **Web Service** từ repo GitHub:

| Mục | Giá trị |
|---|---|
| Root Directory | `apps/api` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment | `DATABASE_URL`, `JWT_SECRET` (chuỗi mới!), `CORS_ORIGINS=https://<tên-web>.vercel.app`, `PUSH_PROVIDER=expo` (nếu dùng push), `NODE_VERSION=22` |

Kiểm tra: `https://<tên-api>.onrender.com/api/health`.

> ⚠️ **Job nhắc nhở chạy bên trong process API.** Gói miễn phí của Render cho server "ngủ" khi không có truy cập → có thể lỡ mốc 08:00. Cách xử lý: dùng gói trả phí / Railway (luôn chạy), **hoặc** tạo thêm một **Render Cron Job** cùng repo với lệnh `npm install && npx tsx src/scripts/runReminders.ts`, lịch `0 1 * * *` (01:00 UTC = 08:00 giờ VN). Nhờ chống trùng trong DB nên chạy nhiều nơi cũng không gửi trùng.

### 4.3. Web (Vercel)

1. Import repo trên vercel.com, **Root Directory** = `apps/web` (Vercel tự nhận Next.js).
2. Environment Variable: `NEXT_PUBLIC_API_URL=https://<tên-api>.onrender.com/api`
3. Deploy, rồi **thêm domain Vercel vào `CORS_ORIGINS` của API** (nếu chưa).

### 4.4. App mobile (EAS)

```bash
cd apps/mobile
npx eas-cli@latest init                                   # nếu chưa làm ở mục 3
npx eas-cli@latest build:configure                        # tạo eas.json
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://<tên-api>.onrender.com/api --environment production
npx eas-cli@latest build --profile preview --platform android    # ra file .apk cài trực tiếp
npx eas-cli@latest build --profile production --platform all     # bản phát hành
npx eas-cli@latest submit --platform android                     # gửi lên Google Play (cần tài khoản dev)
```
Cập nhật nhanh phần JavaScript mà không build lại: `npx eas-cli@latest update`.

### 4.5. Checklist trước khi dùng thật

- [ ] `JWT_SECRET` mới, dài, khác bản local
- [ ] Đổi mật khẩu / xoá các tài khoản demo
- [ ] `CORS_ORIGINS` chỉ chứa domain web thật
- [ ] Sao lưu DB định kỳ (Neon/Supabase có sẵn)
- [ ] Cân nhắc lưu token web bằng cookie `httpOnly` (xem STUDY.md mục 11)

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
