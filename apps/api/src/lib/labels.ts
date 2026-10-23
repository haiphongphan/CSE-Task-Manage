// Nhãn tiếng Việt cho các giá trị enum (dùng trong thông báo, log hoạt động, export)
import type { TaskStatus, TaskType } from '../generated/prisma/client';

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

/** Các loại ấn phẩm BẮT BUỘC nhập kích thước (in ấn) */
export const DIMENSIONS_REQUIRED: TaskType[] = ['BACKDROP', 'BANDROLL', 'STANDEE'];

/** Các loại ấn phẩm BCH chọn ở mục 02 của form */
export const DELIVERABLE_TYPES = ['BANNER', 'BACKDROP', 'BANDROLL', 'STANDEE', 'INVITATION_LETTER', 'OTHER'] as const;
