// Nhãn trạng thái dùng chung (task, sự kiện)
import { Badge } from './ui';
import { EVENT_STATUS_LABEL, TASK_STATUS_LABEL } from '@/lib/format';
import type { EventStatus, Task } from '@/lib/types';

export function TaskStatusBadge({ task }: { task: Pick<Task, 'status' | 'isOverdue'> }) {
  if (task.isOverdue) return <Badge tone="navy">Quá hạn</Badge>;
  if (task.status === 'COMPLETED') return <Badge tone="outline">{TASK_STATUS_LABEL.COMPLETED}</Badge>;
  return <Badge>{TASK_STATUS_LABEL[task.status]}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  if (status === 'DRAFT') return <Badge tone="navy">{EVENT_STATUS_LABEL.DRAFT}</Badge>;
  if (status === 'COMPLETED') return <Badge tone="outline">{EVENT_STATUS_LABEL.COMPLETED}</Badge>;
  return <Badge>{EVENT_STATUS_LABEL.PUBLISHED}</Badge>;
}
