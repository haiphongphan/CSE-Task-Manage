'use client';
// Hộp thư thông báo (mọi vai trò)
import Link from 'next/link';
import { BellRing, CheckCheck } from 'lucide-react';
import { Button, Empty, ErrorBox, Loading, PageHeader, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fmtDayTime } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { PushSettingsCard } from '@/components/PushPrompt';

const TYPE_LABEL: Record<string, string> = {
  DAILY_DIGEST: 'Bản tin 09:00',
  MANUAL_REMIND: 'Nhắc việc từ BCH',
  EVENT_ASSIGNED: 'Phân công mới',
  TASK_UPDATED: 'Cập nhật',
};

export default function NotificationsPage() {
  const { data, error, loading, reload } = useApi<{ items: AppNotification[]; unreadCount: number }>('/notifications?limit=100', { pollMs: 30_000 });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Hộp thư"
        title="Thông báo"
        description="Nhắc nhở tự động, nhắc việc từ BCH và cập nhật về sự kiện của bạn."
        action={
          <Button
            variant="outline"
            icon={<CheckCheck className="size-4" />}
            onClick={async () => {
              await api('/notifications/read-all', { method: 'POST' });
              void reload();
            }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <PushSettingsCard />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <div className="card">
          <Empty>Chưa có thông báo nào</Empty>
        </div>
      ) : (
        <div className="card divide-y divide-divider">
          {data.items.map((n) => (
            <div key={n.id} className={cx('flex gap-4 p-4 sm:p-5', !n.isRead && 'bg-soft')}>
              <BellRing className={cx('mt-0.5 size-5 shrink-0', n.isRead ? 'text-line' : 'text-primary')} />
              <div className="flex-1">
                <p className="text-[10px] uppercase text-primary">{TYPE_LABEL[n.type] ?? n.type}</p>
                <p className="text-sm font-medium text-navy">{n.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {fmtDayTime(n.createdAt)}
                  {n.sentBy ? ` · từ ${n.sentBy.fullName}` : ' · hệ thống'}
                </p>
              </div>
              {(n.eventId || n.type === 'DAILY_DIGEST') && (
                <Link
                  href={n.eventId ? `/events/${n.eventId}` : '/btt/reminders'}
                  onClick={() => api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})}
                  className="self-center text-[13px] text-primary hover:underline"
                >
                  Xem
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
