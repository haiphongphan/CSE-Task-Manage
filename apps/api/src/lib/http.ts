// Lỗi HTTP có mã trạng thái — ném ở bất kỳ đâu, middleware lỗi sẽ chuyển thành JSON.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Bạn cần đăng nhập') => new HttpError(401, msg);
export const forbidden = (msg = 'Bạn không có quyền thực hiện thao tác này') => new HttpError(403, msg);
export const notFound = (msg = 'Không tìm thấy dữ liệu') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Đọc số nguyên dương từ route param, ném 400 nếu sai */
export function parseId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('ID không hợp lệ');
  return n;
}
