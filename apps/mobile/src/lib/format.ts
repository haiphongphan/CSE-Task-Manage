// Bản sao từ apps/web/src/lib/format.ts
// Định dạng ngày giờ & nhãn tiếng Việt. Mọi giờ hiển thị theo giờ Việt Nam (ICT, UTC+7).
import type { EventPhase, EventStatus, Role, TaskStatus, TaskType } from './types';

// Trên điện thoại, engine Hermes có thể thiếu dữ liệu múi giờ đầy đủ, nên tự cộng +7 giờ
// (Việt Nam không có giờ mùa hè) thay vì dùng Intl như bản web.
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const pad = (n: number) => String(n).padStart(2, '0');
const parts = (iso: string | Date) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000); // đọc bằng getUTC* = giờ VN
  return {
    day: pad(d.getUTCDate()),
    month: pad(d.getUTCMonth() + 1),
    year: String(d.getUTCFullYear()),
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    weekday: WEEKDAYS[d.getUTCDay()],
  };
};

/** 25/10/2026 */
export const fmtDate = (iso: string | Date) => {
  const p = parts(iso);
  return `${p.day}/${p.month}/${p.year}`;
};
/** 25/10 */
export const fmtDay = (iso: string | Date) => {
  const p = parts(iso);
  return `${p.day}/${p.month}`;
};
/** 09:00 */
export const fmtTime = (iso: string | Date) => parts(iso).time;
/** 25/10 · 09:00 */
export const fmtDayTime = (iso: string | Date) => `${fmtDay(iso)} · ${fmtTime(iso)}`;
/** 09:00–16:00 */
export const fmtRange = (start: string, end: string) => `${fmtTime(start)}–${fmtTime(end)}`;
/** T5, 22/10/2026 · 09:00 ICT */
export const fmtNow = (d = new Date()) => {
  const p = parts(d);
  return `${p.weekday}, ${p.day}/${p.month}/${p.year} · ${p.time} ICT`;
};

/** "còn 2 ngày 3 giờ" / "quá hạn 39 giờ" */
export function timeLeft(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const d = Math.floor(h / 24);
  const text = h < 1 ? 'dưới 1 giờ' : h < 48 ? `${h} giờ` : `${d} ngày${h % 24 ? ` ${h % 24} giờ` : ''}`;
  return { overdue: diff < 0, text: diff < 0 ? `quá hạn ${text}` : `còn ${text}`, hours: diff / 3_600_000 };
}

/** Chuyển ISO -> giá trị cho <input type="date"> và <input type="time"> theo giờ VN */
export function toDateInput(iso: string) {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}
export const toTimeInput = (iso: string) => fmtTime(iso);
/** Ngược lại: "2026-10-25" + "09:00" (giờ VN) -> ISO string */
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00+07:00`).toISOString();

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', BCH: 'BCH', BTT: 'BTT' };
export const ROLE_DESC: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  BCH: 'Ban Chấp hành',
  BTT: 'Ban Truyền thông',
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  BANNER: 'Banner',
  BACKDROP: 'Backdrop',
  BANDROLL: 'Bandroll',
  STANDEE: 'Standee',
  INVITATION_LETTER: 'Thư mời',
  OTHER: 'Khác',
  PHOTOGRAPHER: 'Phân công chụp ảnh',
  RECAP: 'Recap sự kiện',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang làm',
  IN_REVIEW: 'Chờ duyệt',
  COMPLETED: 'Hoàn thành',
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
};

export const PHASE_LABEL: Record<EventPhase, string> = {
  UPCOMING: 'Sắp diễn ra',
  ONGOING: 'Đang diễn ra',
  POST_EVENT: 'Sau sự kiện',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
