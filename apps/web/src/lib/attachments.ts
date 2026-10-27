// File mẫu / tham chiếu của sự kiện (khớp với apps/api/src/routes/attachments.ts)
import { API_URL, ApiError, tokenStore } from './api';
import type { Attachment } from './types';

export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENTS = 20;
export const ATTACHMENT_EXTS = [
  'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic', 'ai', 'eps', 'psd',
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'zip',
];
/** Giá trị cho <input type="file" accept> */
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTS.map((e) => `.${e}`).join(',');

export const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Lý do file không hợp lệ, hoặc null nếu dùng được */
export function checkAttachment(file: File): string | null {
  if (!ATTACHMENT_EXTS.includes(extOf(file.name))) return `“${file.name}”: định dạng không được hỗ trợ`;
  if (file.size === 0) return `“${file.name}”: file rỗng`;
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) return `“${file.name}”: vượt quá ${MAX_ATTACHMENT_MB} MB`;
  return null;
}

/** 1.2 MB / 340 KB */
export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const authHeader = (): Record<string, string> => {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function failure(res: Response) {
  const data = await res.json().catch(() => ({}));
  return new ApiError(res.status, data.error ?? 'Có lỗi xảy ra', data.details);
}

/** Tải 1 file lên sự kiện: body là nội dung file thô, tên file trên query */
export async function uploadAttachment(eventId: number, file: File) {
  const res = await fetch(`${API_URL}/events/${eventId}/attachments?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...authHeader() },
    body: file,
  }).catch(() => {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra API đã chạy chưa.');
  });
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { attachment: Attachment }).attachment;
}

/** Tải file về máy. Link thường không gửi được token nên phải fetch rồi tạo blob URL */
export async function downloadAttachment(eventId: number, att: Pick<Attachment, 'id' | 'fileName'>) {
  const res = await fetch(`${API_URL}/events/${eventId}/attachments/${att.id}`, { headers: authHeader() });
  if (!res.ok) throw await failure(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = att.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
