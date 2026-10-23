// Mẫu email HTML (màu theo Figma). Email client hỗ trợ CSS rất hạn chế,
// nên dùng <table> + style inline — đây là cách làm chuẩn cho email.
import { config } from '../config';
import { formatVn } from '../lib/time';

const C = { navy: '#03045e', primary: '#0077b6', ice: '#caf0f8', muted: '#53677e', line: '#90e0ef', soft: '#f0fafd' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function layout(title: string, inner: string) {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:${C.ice};font-family:Inter,Segoe UI,Arial,sans-serif;color:${C.navy}">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.ice};padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid ${C.line};border-radius:14px;overflow:hidden">
<tr><td style="background:${C.navy};padding:18px 24px;color:#fff;font-size:17px;font-weight:700">▣ CSE Task Manage</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 6px;font-size:22px;color:${C.navy}">${esc(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:16px 24px;background:${C.soft};font-size:11px;color:${C.muted}">
Email tự động từ CSE Task Manage · Gửi lúc 09:00 mỗi ngày khi bạn còn task chưa hoàn thành.
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:${C.primary};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">${esc(label)}</a>`;

export interface DigestTask {
  title: string;
  dimensions: string | null;
  deadline: Date;
  statusLabel: string;
  flag: 'OVERDUE' | 'SOON' | 'PHOTO' | 'RECAP' | null;
}
export interface DigestEvent {
  id: number;
  name: string;
  startsAt: Date;
  location: string;
  tasks: DigestTask[];
}

const FLAG_LABEL: Record<NonNullable<DigestTask['flag']>, string> = {
  OVERDUE: 'Quá hạn',
  SOON: 'Trong 48 giờ',
  PHOTO: 'Xác nhận chụp ảnh',
  RECAP: 'Cần đăng recap',
};

export function digestEmail(fullName: string, events: DigestEvent[], summary: string) {
  const total = events.reduce((s, e) => s + e.tasks.length, 0);
  const blocks = events
    .map((e) => {
      const rows = e.tasks
        .map(
          (t) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.ice}">
  <div style="font-size:14px">${esc(t.title)}${t.flag ? ` <span style="background:${t.flag === 'OVERDUE' ? C.navy : C.ice};color:${t.flag === 'OVERDUE' ? '#fff' : C.navy};border-radius:99px;padding:2px 8px;font-size:11px">${FLAG_LABEL[t.flag]}</span>` : ''}</div>
  <div style="font-size:12px;color:${C.muted}">${t.dimensions ? esc(t.dimensions) + ' · ' : ''}Hạn ${formatVn(t.deadline)} · ${esc(t.statusLabel)}</div>
</td></tr>`,
        )
        .join('');
      return `<div style="margin-top:20px;border:1px solid ${C.line};border-radius:12px;padding:14px 16px">
  <div style="font-size:16px;font-weight:700">${esc(e.name)}</div>
  <div style="font-size:12px;color:${C.muted};margin-bottom:6px">${formatVn(e.startsAt)} · ${esc(e.location)}</div>
  <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  <div style="margin-top:10px"><a href="${config.webUrl}/events/${e.id}" style="color:${C.primary};font-size:13px">Mở sự kiện →</a></div>
</div>`;
    })
    .join('');

  const subject = `[CSE Task Manage] Bạn còn ${total} việc cần làm hôm nay`;
  const html = layout(
    `Chào ${fullName}, bạn còn ${total} việc cần làm`,
    `<p style="margin:0 0 4px;font-size:14px;color:${C.muted}">${esc(summary)}</p>${blocks}
     <p style="margin:24px 0 0">${button(`${config.webUrl}/btt/reminders`, 'Xem nhắc nhở thông minh')}</p>`,
  );
  const text =
    `Chào ${fullName}, bạn còn ${total} việc cần làm.\n${summary}\n\n` +
    events
      .map(
        (e) =>
          `■ ${e.name} (${formatVn(e.startsAt)})\n` +
          e.tasks.map((t) => `  - ${t.title}${t.flag ? ` [${FLAG_LABEL[t.flag]}]` : ''} · hạn ${formatVn(t.deadline)}`).join('\n'),
      )
      .join('\n\n') +
    `\n\nMở ứng dụng: ${config.webUrl}/btt/reminders`;
  return { subject, html, text };
}

export function welcomeEmail(fullName: string, username: string, tempPassword: string, role: string) {
  const subject = '[CSE Task Manage] Thông tin đăng nhập của bạn';
  const html = layout(
    `Chào ${fullName}!`,
    `<p style="font-size:14px">Admin đã tạo tài khoản <b>${esc(role)}</b> cho bạn trên CSE Task Manage.</p>
     <table cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:10px;padding:14px 16px;font-size:14px;margin:12px 0">
       <tr><td style="color:${C.muted};padding-right:12px">Username</td><td><b>${esc(username)}</b></td></tr>
       <tr><td style="color:${C.muted};padding-right:12px">Mật khẩu tạm</td><td><b>${esc(tempPassword)}</b></td></tr>
     </table>
     <p style="font-size:13px;color:${C.muted}">Bạn sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
     <p>${button(`${config.webUrl}/login`, 'Đăng nhập ngay')}</p>`,
  );
  const text = `Chào ${fullName}!\nAdmin đã tạo tài khoản ${role} cho bạn.\nUsername: ${username}\nMật khẩu tạm: ${tempPassword}\nĐăng nhập: ${config.webUrl}/login`;
  return { subject, html, text };
}
