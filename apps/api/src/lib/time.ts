// Tiện ích thời gian theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
// DB lưu timestamptz (UTC); khi cần "ngày" theo lịch VN thì quy đổi ở đây.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Trả về chuỗi 'YYYY-MM-DD' của ngày theo giờ VN */
export function vnDateString(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Số ngày lịch (theo giờ VN) từ a tới b. VN 23:00 hôm nay -> 01:00 mai = 1 ngày */
export function vnDayDiff(from: Date, to: Date): number {
  const a = Date.parse(vnDateString(from));
  const b = Date.parse(vnDateString(to));
  return Math.round((b - a) / DAY_MS);
}

/** Date (00:00 UTC) đại diện cho một ngày lịch — dùng cho cột kiểu DATE */
export function vnDateOnly(d: Date): Date {
  return new Date(`${vnDateString(d)}T00:00:00.000Z`);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** "25/10 · 09:00" theo giờ VN */
export function formatVn(d: Date): string {
  const s = new Date(d.getTime() + VN_OFFSET_MS).toISOString();
  return `${s.slice(8, 10)}/${s.slice(5, 7)} · ${s.slice(11, 16)}`;
}
