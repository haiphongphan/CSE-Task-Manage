// BTT · Sự kiện đang hoạt động (Figma: "BTT active event list · Mobile")
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, ErrorBox, Icon, Input, Loading, PageHeader, ProgressBar, Screen, StatCard, T } from '@/components/ui';
import { qs } from '@/lib/api';
import { useAuth, useRoleAllowed } from '@/lib/auth';
import { setTab, useOnTabActive } from '@/lib/workspace';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDate, fmtDayTime, fmtNow, fmtRange, TASK_STATUS_LABEL, timeLeft } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventPhase, EventSummary, Reminders } from '@/lib/types';

interface Resp {
  items: EventSummary[];
  stats: { active: number; upcoming: number; postEvent: number; pendingDeliverables: number; photographerPending: number; overdueRecaps: number };
}

export default function BttEventsScreen() {
  const ok = useRoleAllowed('BTT');
  const { user } = useAuth();
  const [phase, setPhase] = useState<'' | EventPhase>('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(ok ? `/events${qs({ phase, search: q })}` : null);
  const reminders = useApi<Reminders>(ok ? '/reminders' : null);
  useOnTabActive(() => (reload(), reminders.reload())); // mở lại tab -> tải lại ngầm
  if (!ok) return <Loading />;
  const s = data?.stats;

  return (
    <Screen onRefresh={() => (reload(), reminders.reload())}>
      <PageHeader
        eyebrow="BTT / Ban Truyền thông"
        title="Sự kiện đang hoạt động"
        description="Các brief được giao cho đội. Ưu tiên rõ ràng, từ chuẩn bị tới recap."
      />
      <Button title={`Nhắc nhở thông minh · ${reminders.data?.total ?? 0}`} icon="bell" variant="outline" onPress={() => setTab('btt/reminders')} />
      <T size={11} color={colors.muted}>
        {user?.fullName} · Ban Truyền thông · {fmtNow()}
      </T>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label="Đang hoạt động" value={s?.active ?? '–'} />
        <StatCard label="Ấn phẩm chờ" value={s?.pendingDeliverables ?? '–'} />
        <StatCard label="Recap quá hạn" value={s?.overdueRecaps ?? '–'} />
      </View>

      <Input value={search} onChangeText={setSearch} placeholder="Tìm sự kiện được giao" icon="search" light />
      <Chips
        value={phase}
        onChange={setPhase}
        options={[
          { value: '', label: `Tất cả ${s?.active ?? ''}` },
          { value: 'UPCOMING', label: `Sắp diễn ra ${s?.upcoming ?? ''}` },
          { value: 'POST_EVENT', label: `Sau sự kiện ${s?.postEvent ?? ''}` },
        ]}
      />

      <T size={17} weight="bold">
        Được giao cho đội media
      </T>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <T color={colors.muted} style={{ textAlign: 'center' }}>
            Không có sự kiện nào đang cần bạn xử lý 🎉
          </T>
        </Card>
      ) : (
        data.items.map((e) => <EventCard key={e.id} e={e} />)
      )}
    </Screen>
  );
}

function EventCard({ e }: { e: EventSummary }) {
  const recapOverdue = e.phase === 'POST_EVENT' && e.progress.overdue > 0;
  const next = e.progress.nextDeadline;
  const left = next ? timeLeft(next.deadline) : null;
  const high = !!left && left.hours < 48;
  const header = recapOverdue
    ? { icon: 'rotate-ccw' as const, text: 'Recap quá hạn' }
    : high
      ? { icon: 'clock' as const, text: `Ưu tiên cao · Hạn ${left!.text}` }
      : { icon: 'calendar' as const, text: `Bình thường · ${e.phase === 'POST_EVENT' ? 'Sau sự kiện' : 'Sắp diễn ra'}` };

  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderColor: recapOverdue ? colors.navy : colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: recapOverdue ? colors.navy : colors.soft }}>
        <Icon name={header.icon} size={14} color={recapOverdue ? colors.white : colors.primary} />
        <T size={12} weight="medium" color={recapOverdue ? colors.white : colors.primary}>
          {header.text}
        </T>
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <View>
          <T size={10} color={colors.primary} upper>
            {e.phase === 'POST_EVENT' ? 'Sau sự kiện' : 'Sắp diễn ra'} · Giao bởi BCH
          </T>
          <T size={20} weight="bold">
            {e.name}
          </T>
          <T size={11} color={colors.muted}>
            Tạo bởi {e.createdBy?.fullName} · Ban Chấp hành
          </T>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="calendar" size={14} />
            <T>
              {fmtDate(e.startsAt)} · {fmtRange(e.startsAt, e.endsAt)}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="map-pin" size={14} />
            <T size={12} color={colors.muted}>
              {e.location}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <T size={30} weight="bold">
            {e.progress.pendingDeliverables || (e.progress.recapPending ? 1 : 0)}
          </T>
          <View style={{ flex: 1 }}>
            <T weight="medium">{e.progress.pendingDeliverables ? 'Ấn phẩm chờ làm' : 'Việc còn lại'}</T>
            <T size={11} color={colors.muted}>
              {e.progress.pendingDeliverables ? 'Ấn phẩm media, chưa tính chụp ảnh' : 'Recap còn lại sau sự kiện'}
            </T>
          </View>
        </View>
        <T size={12}>
          {e.progress.completed} / {e.progress.total} task hoàn thành
        </T>
        <ProgressBar value={e.progress.percent} />
        {next && (
          <View style={{ backgroundColor: colors.soft, borderRadius: 8, padding: 12 }}>
            <T size={12} color={recapOverdue ? colors.navy : colors.primary} weight="medium">
              {recapOverdue ? `${e.progress.overdue} task quá hạn` : `Hạn tiếp theo: ${left!.text}`}
            </T>
            <T size={11} color={colors.muted}>
              {next.taskTitle} · {fmtDayTime(next.deadline)} ICT
            </T>
          </View>
        )}
        {e.openTasks.slice(0, 2).map((t) => (
          <View key={t.id}>
            <T size={12} weight="medium">
              {t.title} · {TASK_STATUS_LABEL[t.status]}
            </T>
            <T size={11} color={colors.muted}>
              {t.dimensions ? `${t.dimensions} · ` : ''}Hạn {fmtDayTime(t.deadline)}
            </T>
          </View>
        ))}
        <T size={11} color={colors.primary}>
          {e.photographerNeeded ? (e.progress.photographerPending ? `+ ${e.photographerQuantity} người chụp ảnh chưa xác nhận` : 'Đã xác nhận người chụp ảnh') : 'Không có task chụp ảnh'}
        </T>
        <Button title="Xem sự kiện" icon="arrow-right" onPress={() => router.push(`/events/${e.id}`)} />
      </View>
    </Card>
  );
}
