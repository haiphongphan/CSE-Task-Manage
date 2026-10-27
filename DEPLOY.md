# DEPLOY.md — Đưa CSE Task Manage lên mạng

Hướng dẫn từng bước với **Supabase** (database), **Render** (API), **Vercel** (web), **Resend** (email). Trên **iPhone**, web được cài như một app (PWA) và nhận thông báo đẩy miễn phí. Trên **Android** có thêm tuỳ chọn file `.apk`.

```
                 ┌──────────── Vercel ────────────┐
 iPhone (PWA) ──►│  apps/web (Next.js)             │◄── Máy tính / Android (trình duyệt)
                 │  + public/sw.js (nhận push)     │
                 └───────────────┬────────────────┘
                                 │ HTTPS
 Android .apk (tuỳ chọn) ────────┤
                                 ▼
                 ┌──────────── Render ────────────┐      ┌─ Resend ─┐
                 │  apps/api (Express + Prisma)    ├─────►│  email   │
                 │  + bản tin 09:00                ├──┐   └──────────┘
                 └───────────────┬────────────────┘  │   ┌─ Apple / Google push ─┐
                                 │ Session pooler     └──►│ Web Push → iPhone      │
                 ┌──────────── Supabase ──────────┐      │ Expo Push → .apk       │
                 │  PostgreSQL 16                  │      └────────────────────────┘
                 └────────────────────────────────┘
 GitHub Actions ── 09:00 mỗi ngày ──► POST /api/cron/daily-digest
```

**Thứ tự nên làm:** 0 → 1 → 2 → 3 → 4 → 5 → 6, còn bước 7 là tuỳ chọn. Mỗi bước cần địa chỉ của bước trước.

| Bước | Việc | Chi phí |
|---|---|---|
| 0 | Chuẩn bị: GitHub, mật khẩu, khoá VAPID | Miễn phí |
| 1 | Supabase: database | Miễn phí (Free plan) |
| 2 | Render: API | Miễn phí (Free, có "ngủ") |
| 3 | Vercel: web | Miễn phí (Hobby) |
| 4 | **Cài lên iPhone + bật thông báo** | Miễn phí, không cần tài khoản Apple Developer |
| 5 | Resend: email | Miễn phí (giới hạn số mail/ngày) |
| 6 | GitHub Actions: hẹn giờ 09:00 | Miễn phí |
| 7 | *(Tuỳ chọn)* File `.apk` cho Android | Miễn phí (có hàng đợi build) |

> Android **không bắt buộc** cần file `.apk`: mở web bằng Chrome → menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính** cũng nhận được thông báo y như iPhone (bước 4). File `.apk` (bước 7) chỉ cần khi bạn muốn app native.

---

## 0. Chuẩn bị

### 0.1. ⚠️ Đổi JWT_SECRET đã lộ

Trước đây file `apps/api/.env.example` từng chứa một `JWT_SECRET` thật và đã được đẩy lên GitHub. File mẫu giờ đã về giá trị giả, nhưng **chuỗi cũ vẫn còn trong lịch sử git**. Vì vậy:
- **Không dùng lại chuỗi đó** ở bất cứ đâu. Mỗi môi trường (local, Render) tạo một chuỗi mới bằng `openssl rand -hex 32`.
- File thật `.env` luôn nằm ngoài git (đã có trong `.gitignore`).

### 0.2. Đẩy code lên GitHub

```bash
cd "~/Code/CSE Task Manage"
git add -A
git commit -m "Thêm bản tin 09:00, email Resend, cấu hình deploy"
git push origin main          # hoặc tên nhánh của bạn
```
Render, Vercel và GitHub Actions đều lấy code từ repo này.

### 0.3. Chuẩn bị mật khẩu & bí mật (ghi ra một chỗ an toàn)

```bash
openssl rand -hex 32   # → JWT_SECRET cho Render
openssl rand -hex 24   # → CRON_SECRET (dùng ở Render + GitHub Actions)

cd "~/Code/CSE Task Manage/apps/api"
npx web-push generate-vapid-keys   # → VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (khoá cho Web Push)
```
> **Khoá VAPID** là cặp khoá máy chủ dùng để "ký" mọi thông báo đẩy gửi tới iPhone/trình duyệt. Tạo **một lần** rồi giữ nguyên: đổi khoá thì mọi thiết bị phải bật thông báo lại. Khoá *private* chỉ đặt trên Render, không đưa vào git.

---

## 1. Supabase: cơ sở dữ liệu

1. Vào https://supabase.com → **New project**.
   - **Region**: chọn **Southeast Asia (Singapore)** cho gần Việt Nam.
   - **Database password**: đặt mật khẩu mạnh, **chỉ dùng chữ và số** (ký tự đặc biệt phải mã hoá khi đưa vào URL, dễ sai).
2. Đợi project tạo xong, bấm nút **Connect** ở đầu trang → chọn **Session pooler** → copy chuỗi kết nối:
   ```
   postgresql://postgres.<PROJECT-REF>:<MẬT-KHẨU>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
   > **Vì sao dùng Session pooler?** Kết nối "Direct" của Supabase chỉ có IPv6, trong khi Render (và nhiều mạng gia đình) chỉ đi IPv4. Session pooler hỗ trợ IPv4 và giữ nguyên phiên kết nối như Postgres bình thường, hợp với server chạy liên tục như API của ta. *(Transaction pooler cổng 6543 dành cho serverless, không hỗ trợ prepared statement nên không dùng.)*
3. Nạp schema từ máy bạn (cần `psql` đã cài theo README):
   ```bash
   cd "~/Code/CSE Task Manage/db"
   export SUPABASE_URL='postgresql://postgres.<PROJECT-REF>:<MẬT-KHẨU>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
   psql "$SUPABASE_URL" -v ON_ERROR_STOP=1 -f schema.sql
   ```
4. **Dữ liệu ban đầu**: chọn một trong hai cách.
   - **Demo** (có sẵn tài khoản `matkhau123`): `psql "$SUPABASE_URL" -f seed.sql`. Sau đó **đổi mật khẩu** các tài khoản, hoặc xoá bớt.
   - **Dùng thật**: chỉ tạo một Admin:
     ```bash
     psql "$SUPABASE_URL" -c "SET search_path TO public, extensions;
       INSERT INTO users (full_name, username, email, role, password_hash, must_change_password)
       VALUES ('Tên Admin', 'admin', 'email-cua-ban@gmail.com', 'ADMIN', crypt('MatKhauTam123', gen_salt('bf', 10)), true);"
     ```
     Đăng nhập lần đầu sẽ bị yêu cầu đổi mật khẩu.
5. Kiểm tra: Supabase → **Table Editor** thấy các bảng `users`, `events`, `tasks`… Mỗi bảng có nhãn **RLS enabled**. Đó là chủ ý: `schema.sql` bật Row Level Security để khoá `anon` công khai của Supabase không đọc được dữ liệu, còn API kết nối bằng user `postgres` (chủ bảng) nên không bị ảnh hưởng.

> **Đã nạp `schema.sql` bản cũ (trước khi có Web Push) và đã có dữ liệu?** Không cần làm lại từ đầu, chỉ chạy thêm:
> ```bash
> psql "$SUPABASE_URL" -f migrations/001_web_push.sql
> ```

> **Khi sửa `schema.sql` sau này**: chạy lại `psql "$SUPABASE_URL" -f schema.sql` sẽ **XOÁ SẠCH DỮ LIỆU**. Với dữ liệu thật, hãy viết lệnh `ALTER TABLE ...` riêng thay vì chạy lại cả file.

---

## 2. Render: API

1. Vào https://render.com → đăng nhập bằng GitHub → **New → Web Service** → chọn repo `CSE-Task-Manage`.
2. Điền:

   | Mục | Giá trị |
   |---|---|
   | Name | `cse-task-manage-api` (địa chỉ sẽ là `https://cse-task-manage-api.onrender.com`) |
   | Region | **Singapore** (cùng vùng với Supabase) |
   | Branch | `main` |
   | Root Directory | `apps/api` |
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |

3. **Environment Variables** (mục *Environment*):

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `DATABASE_URL` | chuỗi Session pooler ở bước 1 |
   | `JWT_SECRET` | chuỗi `openssl rand -hex 32` mới |
   | `CORS_ORIGINS` | tạm để `http://localhost:3000` (sửa ở bước 3) |
   | `WEB_URL` | tạm để `http://localhost:3000` (sửa ở bước 3) |
   | `CRON_SECRET` | chuỗi `openssl rand -hex 24` |
   | `VAPID_PUBLIC_KEY` | khoá *Public Key* ở bước 0.3 |
   | `VAPID_PRIVATE_KEY` | khoá *Private Key* ở bước 0.3 |
   | `VAPID_SUBJECT` | `mailto:email-cua-ban@gmail.com` (Apple yêu cầu có liên hệ người gửi) |
   | `PUSH_PROVIDER` | `expo` (chỉ dùng cho app `.apk`; không có cũng không sao) |
   | `EMAIL_PROVIDER` | `log` (đổi thành `resend` ở bước 5) |

4. Bấm **Create Web Service**, đợi log báo `✅ API chạy tại ...`.
5. Kiểm tra: mở `https://cse-task-manage-api.onrender.com/api/health` → `{"ok":true,...}`.

> **Gói Free "ngủ"**: Render tắt server sau **15 phút** không có truy cập; lần truy cập sau mất khoảng **1 phút** để thức dậy. Hệ quả:
> - Người dùng đầu tiên trong ngày chờ hơi lâu (bình thường).
> - Hẹn giờ 09:00 bên trong API có thể không chạy vì server đang ngủ → **bước 6** dùng GitHub Actions gọi API đúng giờ. API cũng tự **gửi bù** nếu khởi động sau 09:00 mà hôm nay chưa gửi; DB chặn gửi trùng nên chạy nhiều lần cũng an toàn.
> - Render Free **chặn cổng SMTP** (25/465/587). Resend gửi qua HTTPS API nên không bị ảnh hưởng.

---

## 3. Vercel: web

1. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New → Project** → chọn repo.
2. **Root Directory**: bấm *Edit* → chọn `apps/web` (Vercel tự nhận Next.js).
3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://cse-task-manage-api.onrender.com/api` |

4. **Deploy**. Địa chỉ web dạng `https://cse-task-manage.vercel.app`.
5. **Quay lại Render** → Environment → sửa rồi **Save** (Render tự deploy lại):
   - `CORS_ORIGINS` = `https://cse-task-manage.vercel.app` (nhiều địa chỉ thì cách nhau bởi dấu phẩy)
   - `WEB_URL` = `https://cse-task-manage.vercel.app`
6. Mở web, đăng nhập thử. Nếu lỗi "Không kết nối được máy chủ": đợi 1 phút cho Render thức dậy rồi tải lại.

> Biến `NEXT_PUBLIC_*` được **nhúng vào code lúc build**. Đổi giá trị trên Vercel xong phải **Redeploy** mới có hiệu lực.

---

## 4. Cài lên iPhone và bật thông báo

Web đã là một **PWA** (Progressive Web App): có `manifest`, icon, và service worker (`apps/web/public/sw.js`) chạy nền để nhận thông báo. Từ iOS 16.4, Apple cho web app **đã thêm vào màn hình chính** nhận Web Push. Cách này không cần tài khoản Developer, không hết hạn, và mỗi lần deploy lên Vercel thì máy tự có bản mới.

### 4.1. Cài lên màn hình chính (mỗi iPhone làm 1 lần)

1. Mở **Safari** trên iPhone (Chrome trên iPhone cũng có mục này, nhưng Safari chắc nhất) → vào `https://cse-task-manage.vercel.app`.
2. Bấm nút **Chia sẻ** (ô vuông có mũi tên lên, ở thanh dưới) → kéo xuống chọn **Thêm vào MH chính** → bật **Mở dưới dạng ứng dụng web** nếu có → **Thêm**.
3. Trên màn hình chính có icon **CSE Task** (logo xanh). **Từ giờ luôn mở bằng icon này**: chỉ bản mở từ icon mới nhận được thông báo.

### 4.2. Bật thông báo

1. Mở **CSE Task** từ icon → đăng nhập.
2. Đầu trang có ô **"Bật thông báo trên thiết bị này"** → bấm **Bật thông báo** → iPhone hỏi quyền → **Cho phép**.
   (Ẩn ô đó rồi thì vào avatar góc phải → **Cài đặt thông báo**.)
3. Ở trang **Thông báo**, bấm **Gửi thử** → khoá màn hình, vài giây sau thông báo hiện ra. Bấm vào thông báo sẽ mở đúng trang trong app.

Mỗi thiết bị (iPhone, iPad, máy tính) bật riêng một lần. Thiết bị nào bật thì nhận:

| Thông báo | Khi nào | Bấm vào mở |
|---|---|---|
| **Bản tin 09:00** (BTT) | Mỗi sáng, nếu còn task chưa xong | Nhắc nhở thông minh |
| Phân công mới (BTT) | BCH gửi sự kiện / thêm bạn vào nhóm | Chi tiết sự kiện |
| Nhắc việc (BTT) | BCH bấm **Nhắc** ở một task | Chi tiết sự kiện |
| Đã hoàn thành (BCH) | BTT đánh dấu xong một task | Chi tiết sự kiện |

### 4.3. Nếu không thấy thông báo

| Hiện tượng | Cách xử lý |
|---|---|
| Trang ghi "Cần cài lên màn hình chính" | Bạn đang mở trong Safari, chưa mở từ icon → làm lại 4.1 |
| Trang ghi "Đã bị chặn" | iPhone: **Cài đặt → Thông báo → CSE Task → Cho phép thông báo**, rồi mở lại app |
| Trang ghi "Máy chủ chưa bật Web Push" | Render chưa có `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (bước 2) |
| Bấm **Gửi thử** báo đã gửi nhưng không thấy gì | Tắt chế độ **Tập trung / Không làm phiền**; khoá màn hình rồi đợi 10–20 giây |
| Đổi khoá VAPID / cài lại icon | Mở app → **Cài đặt thông báo** → **Bật** lại |
| **Gửi thử** báo "Máy chủ chưa có đăng ký của thiết bị này" | Bấm **Bật thông báo** lại (đăng ký cũ đã hết hạn hoặc bị xoá) |
| **Gửi thử** báo "Apple/Google từ chối: 403 …" | Khoá VAPID trên Render khác với lúc đăng ký → kiểm tra lại 2 biến VAPID, rồi Tắt → Bật lại thông báo |
| Gửi thử được nhưng không có bản tin 09:00 | Bản tin chỉ gửi cho **tài khoản BTT** có task. Đăng nhập đúng tài khoản BTT trên iPhone. Kiểm tra lịch đánh thức ở mục 6 |

> **Bản tin chỉ có 1 thông báo/ngày.** "Đăng recap", "xác nhận chụp ảnh" và các ấn phẩm còn lại đều là các dòng trong cùng một thông báo *"Bạn còn N việc cần làm hôm nay"*, không có thông báo recap riêng. Recap được đưa vào bản tin **ngay khi sự kiện kết thúc**. Nếu sự kiện kết thúc sau giờ bản tin hôm đó thì recap có trong bản tin sáng hôm sau. Nếu bản tin hôm nay đã tạo nhưng lúc đó điện thoại chưa bật thông báo, lần gọi tiếp theo (job 09:00, GitHub dự phòng, hoặc Admin bấm **Gửi bản tin ngay**) sẽ **đẩy lại** với nội dung mới nhất.

> Xoá icon khỏi màn hình chính = huỷ đăng ký thông báo. Lần sau API gửi sẽ nhận lỗi "hết hạn" và tự xoá đăng ký đó.

---

## 5. Resend: email

1. Đăng ký https://resend.com → **API Keys → Create API Key** (quyền *Sending access*) → copy key dạng `re_...`.
2. **Thử nhanh không cần tên miền:** trên Render đặt
   - `EMAIL_PROVIDER` = `resend`
   - `RESEND_API_KEY` = `re_...`
   - `EMAIL_FROM` = `CSE Task Manage <onboarding@resend.dev>`

   ⚠️ Địa chỉ thử `onboarding@resend.dev` **chỉ gửi được tới email bạn dùng đăng ký Resend**. Để thử, tạo một tài khoản BTT có đúng email đó.
3. **Gửi cho mọi người**: cần **tên miền riêng** (mua ở Namecheap, Mắt Bão, Tenten… khoảng vài trăm nghìn/năm):
   1. Resend → **Domains → Add Domain** → nhập tên miền con, VD `mail.tenmien.vn`.
   2. Resend hiện các bản ghi DNS (TXT cho SPF/DKIM, MX). Vào trang quản lý DNS của nơi mua tên miền và thêm **đúng từng dòng**.
   3. Bấm **Verify**; DNS có thể mất vài phút tới vài giờ.
   4. Đổi trên Render: `EMAIL_FROM` = `CSE Task Manage <thongbao@mail.tenmien.vn>`.
4. Kiểm tra: đăng nhập web bằng Admin → **Quản lý task** → **Gửi bản tin ngay**, rồi xem hộp thư (và cả mục Spam). Trên Resend → **Emails** xem trạng thái từng mail.

Email được gửi trong 2 trường hợp:
- **Bản tin 09:00** cho mỗi BTT còn việc: gộp mọi task chưa xong theo từng sự kiện, đánh dấu *Quá hạn / Trong 48 giờ / Xác nhận chụp ảnh / Cần đăng recap*.
- **Admin tạo tài khoản** và tick "Gửi thông tin đăng nhập qua email".

---

## 6. Hẹn giờ 09:00 mỗi ngày (đánh thức Render)

**Vì sao cần:** Render Free cho API "ngủ" sau 15 phút không có truy cập. Lúc 09:00 server đang ngủ nên lịch `node-cron` bên trong API không chạy được. Phải có một dịch vụ bên ngoài **gọi API đúng giờ**. Khi được đánh thức sau 09:00, API cũng tự gửi bù bản tin (`DIGEST_CATCH_UP_ON_START`), nên chỉ cần đánh thức đúng giờ là đủ.

> ⚠️ **Đừng dựa vào lịch của GitHub Actions.** GitHub chạy lịch theo kiểu "cố gắng": giờ cao điểm thường trễ từ vài phút tới vài giờ, có hôm bỏ luôn. Lịch `0 2 * * *` (09:00 VN) từng chạy lúc 14:03 và 14:28. Giữ GitHub làm **dự phòng** thôi.

### 6.1. Cách chính: cron-job.org (miễn phí, chính xác tới phút)

1. Đăng ký tại https://cron-job.org → **Settings** → đặt **Time zone = Asia/Ho_Chi_Minh**.
2. **Create cronjob** thứ nhất (đánh thức):
   - Title: `CSE wake` · URL: `https://cse-task-manage-api.onrender.com/api/health`
   - Schedule: **Every day at 08:57**
3. **Create cronjob** thứ hai (gửi bản tin):
   - Title: `CSE digest` · URL: `https://cse-task-manage-api.onrender.com/api/cron/daily-digest`
   - Schedule: **Every day at 09:00**
   - Tab **Advanced**: Request method **POST**, thêm Header `x-cron-secret` = giá trị `CRON_SECRET` trên Render
4. Bấm **Test run** ở job thứ hai: thấy `200` và `{"recipients":…,"sent":…,"resent":…}` là xong.

> cron-job.org ngắt request sau 30 giây. Job 08:57 có thể báo "timeout" vì Render mất ~1 phút để khởi động. Không sao: request đó vẫn đánh thức được server, tới 09:00 server đã thức để nhận job thứ hai.

### 6.2. Cách khác (chọn 1 nếu không thích cron-job.org)

| Cách | Làm thế nào | Ưu / nhược |
|---|---|---|
| **Giữ Render luôn thức**: UptimeRobot / Better Stack | Tạo monitor HTTP tới `/api/health`, chu kỳ 5 phút | Cron bên trong API tự chạy đúng 09:00, web cũng không phải chờ khởi động. 1 service chạy cả tháng ≈ 744 giờ, vừa đủ 750 giờ free của Render. Nếu có service Render free thứ hai thì không đủ giờ |
| **Supabase pg_cron + pg_net** | Database → Extensions bật `pg_cron`, `pg_net`, rồi chạy SQL ở dưới | Không cần thêm tài khoản. Phải lưu CRON_SECRET trong SQL của Supabase |
| **Render trả phí** (Starter ~7 USD/tháng) | Đổi gói instance | Không ngủ nữa, chạy đúng giờ, không cần dịch vụ ngoài |

SQL cho Supabase (SQL Editor). `0 2 * * *` là giờ UTC = 09:00 VN:

```sql
select cron.schedule('cse-wake', '57 1 * * *', $$
  select net.http_get('https://cse-task-manage-api.onrender.com/api/health', timeout_milliseconds := 60000)
$$);
select cron.schedule('cse-digest', '0 2 * * *', $$
  select net.http_post(
    url := 'https://cse-task-manage-api.onrender.com/api/cron/daily-digest',
    headers := '{"x-cron-secret": "<CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000)
$$);
-- Xem kết quả: select * from cron.job_run_details order by start_time desc limit 5;
```

### 6.3. GitHub Actions (dự phòng)

File `.github/workflows/daily-digest.yml` vẫn giữ. Nếu cách chính lỡ hẹn, GitHub chạy trễ vẫn gửi bù được. Nếu bản tin đã gửi rồi thì không có tin trùng, vì DB chặn mỗi người 1 bản tin/ngày.

1. GitHub → repo → **Settings → Secrets and variables → Actions**, tạo `API_URL` = `https://cse-task-manage-api.onrender.com/api` và `CRON_SECRET` (giống Render).
2. Tab **Actions** → *Daily digest* → **Run workflow** để thử.

---

## 7. (Tuỳ chọn) App Android (.apk)

Chỉ cần khi muốn app native trên Android. Người dùng Android vẫn có thể cài bản web như bước 4 (Chrome → ⋮ → **Cài đặt ứng dụng**).

### 7.1. Chuẩn bị một lần

```bash
npm install -g eas-cli          # hoặc dùng "npx eas-cli@latest" thay cho "eas"
cd "~/Code/CSE Task Manage/apps/mobile"
eas login                       # tạo tài khoản miễn phí tại expo.dev nếu chưa có
eas init                        # tạo project trên expo.dev, tự ghi extra.eas.projectId vào app.json
```

Mở `apps/mobile/eas.json`, thay **cả 3 chỗ** `https://YOUR-API.onrender.com/api` bằng địa chỉ API thật (bước 2). Đây là địa chỉ app gọi tới khi đã cài lên máy.

### 7.2. Bật thông báo đẩy cho Android (Firebase FCM)

Android nhận push qua Firebase Cloud Messaging. Làm một lần:
1. https://console.firebase.google.com → **Add project** (tắt Google Analytics cho gọn).
2. **Add app → Android**, *package name* = `vn.edu.hcmut.csetaskmanage` (khớp `app.json`) → tải **`google-services.json`** → đặt vào `apps/mobile/google-services.json`.
3. Thêm vào `apps/mobile/app.json` trong mục `"android"`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
4. Firebase → ⚙️ **Project settings → Service accounts → Generate new private key** → tải file JSON (**không** commit file này).
5. Đưa key lên EAS:
   ```bash
   eas credentials -p android
   # → production / preview → Google Service Account → "Manage your Google Service Account Key for Push Notifications (FCM V1)" → Upload file JSON vừa tải ở trên
   ```
Hướng dẫn gốc: https://docs.expo.dev/push-notifications/fcm-credentials/

### 7.3. Build file .apk

```bash
eas build -p android --profile preview
```
- Lần đầu EAS hỏi tạo **keystore** (khoá ký app) → chọn *Yes* để EAS tạo và giữ hộ.
- Build chạy trên cloud của Expo (gói miễn phí có thể xếp hàng 10–30 phút). Xong sẽ có **link + mã QR** tải file `.apk`.
- Trên điện thoại Android: mở link → tải → cài (cho phép "Cài ứng dụng không rõ nguồn gốc" nếu được hỏi). Gửi link cho các thành viên khác để cài.

Cập nhật bản mới: sửa code → chạy lại lệnh build → cài đè.

> Muốn lên **Google Play**: `eas build -p android --profile production` (ra file `.aab`) rồi `eas submit -p android`. Cần tài khoản Google Play Console (25 USD, trả một lần).

---

## 8. Kiểm tra cuối & checklist

- [ ] `https://<api>.onrender.com/api/health` trả `ok: true`
- [ ] Web trên Vercel đăng nhập được 3 vai trò
- [ ] iPhone: đã **Thêm vào MH chính**, mở từ icon, trang Thông báo ghi "Đang bật trên thiết bị này", **Gửi thử** nhận được
- [ ] BCH tạo sự kiện → BTT thấy ngay; iPhone của BTT nhận push "Bạn được phân công sự kiện mới"
- [ ] Admin → **Gửi bản tin ngay** → BTT nhận **1 push + 1 email** gộp mọi task
- [ ] GitHub Actions → Run workflow thành công
- [ ] Đã đổi mật khẩu / xoá tài khoản demo
- [ ] `JWT_SECRET`, `CRON_SECRET`, `VAPID_PRIVATE_KEY` là chuỗi mới, không nằm trong git

## 9. Lỗi thường gặp khi deploy

| Triệu chứng | Nguyên nhân / Cách xử lý |
|---|---|
| Render build lỗi `prisma generate` | Thiếu `DATABASE_URL`, hoặc Root Directory chưa đặt `apps/api` |
| API log `ENETUNREACH` / `connect timeout` tới Supabase | Đang dùng chuỗi **Direct** (IPv6) → đổi sang **Session pooler** |
| `password authentication failed` | Sai mật khẩu, hoặc mật khẩu có ký tự đặc biệt chưa mã hoá URL (VD `@` → `%40`) |
| Web báo lỗi CORS | `CORS_ORIGINS` trên Render chưa có đúng địa chỉ Vercel (không có `/` ở cuối) |
| Email không tới | `onboarding@resend.dev` chỉ gửi tới email chủ tài khoản Resend; xem tab **Emails** trên Resend; kiểm tra Spam |
| App cài xong báo "Không kết nối được máy chủ" | `EXPO_PUBLIC_API_URL` trong `eas.json` còn là `YOUR-API` → sửa rồi build lại |
| iPhone không nhận push | Xem bảng ở mục 4.3 |
| App `.apk` không nhận push | Thiếu `google-services.json` / FCM key (mục 7.2) |
| GitHub Actions lỗi 403 | `CRON_SECRET` ở GitHub khác Render |
| Bản tin không gửi lúc 09:00 | Kiểm tra tab Actions; API cũng tự gửi bù khi có người truy cập sau 09:00 |
