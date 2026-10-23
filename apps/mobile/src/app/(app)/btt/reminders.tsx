// BTT · Nhắc nhở thông minh
import { ReminderCards } from '@/components/shared';
import { ErrorBox, Loading, PageHeader, Screen } from '@/components/ui';
import { useRoleAllowed } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import type { Reminders } from '@/lib/types';

export default function RemindersScreen() {
  const ok = useRoleAllowed('BTT');
  const { data, error, loading, reload } = useApi<Reminders>(ok ? '/reminders' : null, { pollMs: 60_000 });
  if (!ok) return <Loading />;
  return (
    <Screen onRefresh={reload}>
      <PageHeader
        eyebrow="BTT / Ban Truyền thông"
        title="Nhắc nhở thông minh"
        description="Nhắc chụp ảnh từ 3 ngày trước sự kiện, nhắc recap sau sự kiện và cảnh báo hạn chót."
        meta={`${data?.total ?? 0} nhắc nhở đang bật`}
      />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading && !data ? <Loading /> : <ReminderCards data={data} onChanged={reload} />}
    </Screen>
  );
}
