// =====================================================================
// Kiểm thử nhanh toàn bộ luồng API (smoke test)
// Yêu cầu: API đang chạy + DB vừa nạp seed.sql
//   npm run smoke            (mặc định http://localhost:4000/api)
//   API_URL=... npm run smoke
// =====================================================================
const API = process.env.API_URL ?? 'http://localhost:4000/api';
let passed = 0;

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function check(name: string, cond: unknown, extra?: unknown) {
  if (!cond) {
    console.error(`❌ ${name}`, extra ?? '');
    process.exit(1);
  }
  passed++;
  console.log(`✅ ${name}`);
}

async function login(username: string) {
  const r = await call('POST', '/auth/login', undefined, { login: username, password: 'matkhau123' });
  check(`Đăng nhập ${username}`, r.status === 200 && r.json.token, r.json);
  return r.json.token as string;
}

async function main() {
  const admin = await login('linh.nguyen');
  const bch = await login('mai.anh');
  const btt = await login('minh.tran');

  // --- Đăng ký ---
  const suffix = Date.now().toString().slice(-6);
  let r = await call('POST', '/auth/register', undefined, {
    fullName: 'Người Thử', username: `thu.${suffix}`, email: `thu.${suffix}@cse.edu.vn`,
    password: 'matkhau123', confirmPassword: 'matkhau123', role: 'ADMIN',
  });
  check('Đăng ký với role ADMIN bị từ chối', r.status === 400, r.json);
  r = await call('POST', '/auth/register', undefined, {
    fullName: 'Người Thử', username: `thu.${suffix}`, email: `thu.${suffix}@cse.edu.vn`,
    password: 'matkhau123', confirmPassword: 'matkhau123', role: 'BTT',
  });
  check('Đăng ký BTT thành công', r.status === 201 && r.json.user.role === 'BTT', r.json);
  const newBttId = r.json.user.id as number;

  // --- Admin: tài khoản ---
  r = await call('GET', '/users?role=BTT', admin);
  check('Admin xem danh sách BTT', r.status === 200 && r.json.items.every((u: any) => u.role === 'BTT'), r.json);
  r = await call('GET', '/users', btt);
  check('BTT không xem được danh sách user', r.status === 403);
  r = await call('PATCH', `/users/${newBttId}`, admin, { fullName: 'Người Thử Đã Sửa' });
  check('Admin sửa tài khoản', r.status === 200 && r.json.user.fullName === 'Người Thử Đã Sửa', r.json);

  // --- BCH: tạo sự kiện ---
  r = await call('GET', '/users/options?role=BTT', bch);
  check('BCH lấy danh sách BTT', r.status === 200 && r.json.items.length >= 4, r.json);
  const bttIds = r.json.items.map((u: any) => u.id) as number[];
  const minh = r.json.items.find((u: any) => u.username === 'minh.tran');

  const day = 24 * 3600 * 1000;
  const start = new Date(Date.now() + 10 * day);
  const end = new Date(start.getTime() + 3 * 3600 * 1000);
  const payload = {
    name: 'Sự kiện kiểm thử', location: 'Phòng test', startsAt: start, endsAt: end,
    notes: 'Ghi chú', onlineContent: 'Online', offlineContent: 'Offline',
    photographerNeeded: true, photographerQuantity: 2,
    memberIds: [minh.id, bttIds.find((id) => id !== minh.id)],
    deliverables: [
      { type: 'BANNER', dimensions: '1920 × 1080 px', deadline: new Date(Date.now() + 1 * day) },
      { type: 'STANDEE', dimensions: '80 × 180 cm', deadline: new Date(Date.now() + 6 * day) },
    ],
    publish: true,
  };
  r = await call('POST', '/events', bch, { ...payload, deliverables: [{ type: 'BACKDROP', deadline: start }] });
  check('Backdrop thiếu kích thước bị từ chối', r.status === 400, r.json);
  r = await call('POST', '/events', btt, payload);
  check('BTT không tạo được sự kiện', r.status === 403);
  r = await call('POST', '/events', bch, payload);
  check('BCH tạo + phân công sự kiện', r.status === 201 && r.json.event.tasks.length === 4, r.json);
  const ev = r.json.event;
  const recap = ev.tasks.find((t: any) => t.type === 'RECAP');
  check(
    'Hạn recap = kết thúc + 7 ngày',
    Math.abs(new Date(recap.deadline).getTime() - (end.getTime() + 7 * day)) < 1000,
    recap,
  );

  // --- BTT ---
  r = await call('GET', '/notifications', btt);
  check('BTT nhận thông báo được phân công', r.json.items.some((n: any) => n.type === 'EVENT_ASSIGNED' && n.eventId === ev.id));
  r = await call('GET', '/events', btt);
  check('BTT thấy sự kiện được phân công', r.json.items.some((e: any) => e.id === ev.id), r.json);
  r = await call('GET', `/events/${ev.id}`, btt);
  check('BTT xem chi tiết', r.status === 200 && r.json.event.permissions.canUpdateTasks, r.json);
  const banner = ev.tasks.find((t: any) => t.type === 'BANNER');
  r = await call('PATCH', `/tasks/${banner.id}`, btt, { deadline: new Date() });
  check('BTT không được đổi hạn chót', r.status === 403);
  r = await call('PATCH', `/tasks/${banner.id}`, btt, { status: 'COMPLETED' });
  check('BTT đánh dấu hoàn thành', r.status === 200 && r.json.task.progress === 100 && r.json.task.completedAt, r.json);
  r = await call('GET', '/reminders', btt);
  check('BTT xem nhắc nhở thông minh', r.status === 200 && Array.isArray(r.json.photo) && Array.isArray(r.json.recap), r.json);

  // --- BCH: sửa, nhắc ---
  r = await call('PUT', `/events/${ev.id}`, bch, {
    ...payload,
    name: 'Sự kiện kiểm thử (đã sửa)',
    deliverables: [{ id: banner.id, type: 'BANNER', dimensions: '1200 × 628 px', deadline: banner.deadline }],
  });
  check('BCH sửa sự kiện chưa diễn ra', r.status === 200 && r.json.event.tasks.length === 3, r.json);
  r = await call('POST', `/tasks/${recap.id}/remind`, bch, {});
  check('BCH gửi nhắc việc', r.status === 200 && r.json.sent >= 1, r.json);
  r = await call('PUT', '/events/3', bch, payload);
  check('BCH không sửa được sự kiện đã diễn ra', r.status === 403, r.json);

  // --- Admin: task ---
  r = await call('GET', '/tasks?status=OVERDUE', admin);
  check('Admin lọc task quá hạn', r.status === 200 && r.json.items.every((t: any) => t.isOverdue), r.json);
  r = await call('PATCH', `/tasks/${recap.id}`, admin, { progress: 50, status: 'IN_PROGRESS', notes: 'Admin sửa' });
  check('Admin sửa task', r.status === 200 && r.json.task.progress === 50, r.json);
  r = await call('POST', '/admin/run-digest', admin);
  check('Admin gửi bản tin hằng ngày', r.status === 200 && r.json.recipients >= 1, r.json);
  r = await call('POST', '/admin/run-digest', admin);
  check('Gửi lại trong ngày không tạo trùng', r.status === 200 && r.json.sent === 0, r.json);
  r = await call('GET', '/notifications', btt);
  const digests = r.json.items.filter((n: any) => n.type === 'DAILY_DIGEST');
  check('BTT nhận đúng 1 bản tin gộp hôm nay', digests.length === 1 && /việc cần làm/.test(digests[0].title), digests);
  r = await call('POST', '/cron/daily-digest');
  check('Cron endpoint chặn khi thiếu CRON_SECRET', r.status === 403, r.json);
  if (process.env.CRON_SECRET) {
    const res = await fetch(API + '/cron/daily-digest', { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    check('Cron endpoint chạy với CRON_SECRET đúng', res.status === 200);
  }
  const exp = await fetch(`${API}/tasks/export.csv`, { headers: { Authorization: `Bearer ${admin}` } });
  check('Export CSV', exp.status === 200 && (await exp.text()).includes('Mã'));

  // --- Web Push (iPhone / trình duyệt) ---
  r = await call('GET', '/push/web/public-key', btt);
  check('Lấy khoá VAPID công khai', r.status === 200 && 'enabled' in r.json, r.json);
  const fakeSub = { endpoint: `https://push.example.invalid/${suffix}`, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  r = await call('POST', '/push/web/subscriptions', btt, { endpoint: 'khong-phai-url', keys: fakeSub.keys });
  check('Đăng ký Web Push sai định dạng bị từ chối', r.status === 400, r.json);
  r = await call('POST', '/push/web/subscriptions', btt, fakeSub);
  check('Lưu đăng ký Web Push', r.status === 204, r.json);
  r = await call('DELETE', '/push/web/subscriptions', btt, { endpoint: fakeSub.endpoint });
  check('Gỡ đăng ký Web Push', r.status === 204, r.json);

  // --- Dọn dẹp ---
  r = await call('DELETE', `/events/${ev.id}`, admin);
  check('Admin xoá sự kiện kiểm thử', r.status === 204);
  r = await call('DELETE', `/users/${newBttId}`, admin);
  check('Admin xoá tài khoản kiểm thử', r.status === 204);

  console.log(`\n🎉 ${passed} kiểm tra đều đạt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
