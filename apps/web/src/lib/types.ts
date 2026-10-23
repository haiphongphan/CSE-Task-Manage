// Kiểu dữ liệu API trả về (khớp với apps/api/src/services/presenters.ts)

export type Role = 'ADMIN' | 'BCH' | 'BTT';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED';
export type EventPhase = 'UPCOMING' | 'ONGOING' | 'POST_EVENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
export type TaskType =
  | 'BANNER'
  | 'BACKDROP'
  | 'BANDROLL'
  | 'STANDEE'
  | 'INVITATION_LETTER'
  | 'OTHER'
  | 'PHOTOGRAPHER'
  | 'RECAP';

export interface User {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  createdAt?: string;
}

export interface MiniUser {
  id: number;
  fullName: string;
  role: Role;
}

export interface Task {
  id: number;
  code: string;
  eventId: number;
  event?: { id: number; name: string };
  type: TaskType;
  title: string;
  dimensions: string | null;
  deadline: string;
  assignee: MiniUser | null;
  status: TaskStatus;
  progress: number;
  notes: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  updatedAt: string;
}

export interface EventSummary {
  id: number;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  phase: EventPhase;
  editable: boolean;
  photographerNeeded: boolean;
  photographerQuantity: number;
  createdBy: MiniUser | null;
  members: MiniUser[];
  progress: {
    total: number;
    completed: number;
    percent: number;
    overdue: number;
    pendingDeliverables: number;
    photographerPending: boolean;
    recapPending: boolean;
    nextDeadline: { taskTitle: string; deadline: string } | null;
  };
  openTasks: { id: number; title: string; type: TaskType; status: TaskStatus; dimensions: string | null; deadline: string }[];
  updatedAt: string;
}

export interface EventDetail extends EventSummary {
  notes: string | null;
  onlineContent: string | null;
  offlineContent: string | null;
  publishedAt: string | null;
  tasks: Task[];
  permissions: {
    canEdit: boolean;
    canRemind: boolean;
    canUpdateTasks: boolean;
    canDelete: boolean;
  };
}

export interface Activity {
  id: number;
  message: string;
  actor: { id: number; fullName: string } | null;
  createdAt: string;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  eventId: number | null;
  taskId: number | null;
  sentBy: { id: number; fullName: string } | null;
  isRead: boolean;
  createdAt: string;
}

export interface ReminderEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  location: string;
  photographerQuantity: number;
}

export interface Reminders {
  photo: { kind: 'PHOTO'; task: Task; event: ReminderEvent; daysUntilEvent: number }[];
  recap: { kind: 'RECAP'; task: Task; event: ReminderEvent; daysSinceEvent: number }[];
  deadline: Task[];
  total: number;
}
