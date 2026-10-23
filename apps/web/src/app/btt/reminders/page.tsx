'use client';
// BTT · Nhắc nhở thông minh — tất cả nhắc nhở đang bật của bạn
import { Bell } from 'lucide-react';
import { ErrorBox, Loading, PageHeader } from '@/components/ui';
import { ReminderCards } from '@/components/ReminderCards';
import { useApi } from '@/lib/useApi';
import type { Reminders } from '@/lib/types';

export default function RemindersPage() {
  const { data, error, loading, reload } = useApi<Reminders>('/reminders', { pollMs: 60_000 });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BTT / Ban Truyền thông"
        title="Nhắc nhở thông minh"
        description="Nhắc chụp ảnh từ 3 ngày trước sự kiện, nhắc recap sau sự kiện và cảnh báo hạn chót — tự động mỗi ngày."
        meta={
          <>
            <Bell className="size-4 text-primary" /> {data?.total ?? 0} nhắc nhở đang bật
          </>
        }
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <div className="mx-auto w-full max-w-[560px]">
          <ReminderCards data={data} onChanged={reload} />
        </div>
      )}
    </div>
  );
}
