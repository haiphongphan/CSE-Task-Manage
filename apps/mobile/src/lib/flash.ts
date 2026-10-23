// Lời nhắn một lần giữa 2 màn hình (VD: lưu sự kiện xong -> hiện thông báo ở danh sách)
let message: string | null = null;
export const setFlash = (m: string) => (message = m);
export const takeFlash = () => {
  const m = message;
  message = null;
  return m;
};
