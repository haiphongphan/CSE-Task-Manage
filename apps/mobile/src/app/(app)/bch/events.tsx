// BCH · Sự kiện của tôi (Figma: "BCH event list · Mobile")
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { EventStatusBadge } from '@/components/shared';
import { Alert, Button, Card, Chips, ErrorBox, Input, Loading, PageHeader, ProgressBar, Screen, StatCard, T } from '@/components/ui';
import { qs } from '@/lib/api';
import { useAuth, useRoleAllowed } from '@/lib/auth';
import { takeFlash } from '@/lib/flash';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDate, fmtDayTime, fmtNow, fmtRange } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventStatus, EventSummary } from '@/lib/types';

interface Resp {
  items: EventSummary[];
  stats: { total: number; draft: number; published: number; completed: number };
}

export default function BchEventsScreen() {
  const ok = useRoleAllowed('BCH');
  const { user } = useAuth();
  const [status, setStatus] = useState<'' | EventStatus>('');
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(ok ? `/events${qs({ status, search: q })}` : null);

  // Quay lại màn này (sau khi tạo/sửa) -> tải lại + hiện thông báo
  useFocusEffect(
    useCallback(() => {
      const f = takeFlash();
      if (f) {
        setFlash(f);
        void reload();
      }
    }, [reload]),
  );

  if (!ok) return <Loading />;
  const s = data?.stats;

  return (
    <Screen onRefresh={reload}>
      <PageHeader eyebrow="BCH / Ban Chấp hành" title="Sự kiện của tôi" description="Quản lý brief, phân công và tiến độ sự kiện." />
      <Button title="Tạo sự kiện" icon="plus" onPress={() => router.push('/bch/event-form')} style={{ alignSelf: 'flex-start' }} />
      <T size={11} color={colors.muted}>
        {user?.fullName} · Ban Chấp hành · {fmtNow()}
      </T>
      {flash && <Alert tone="success">✓ {flash}</Alert>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Sự kiện của tôi" value={s?.total ?? '–'} />
        <StatCard label="Nháp" value={s?.draft ?? '–'} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: -10 }}>
        <StatCard label="Đang thực hiện" value={s?.published ?? '–'} />
        <StatCard label="Hoàn thành" value={s?.completed ?? '–'} />
      </View>

      <Input value={search} onChangeText={setSearch} placeholder="Tìm sự kiện của bạn" icon="search" light />
      <Chips
        value={status}
        onChange={setStatus}
        options={[
          { value: '', label: `Tất cả ${s?.total ?? ''}` },
          { value: 'DRAFT', label: `Nháp ${s?.draft ?? ''}` },
          { value: 'PUBLISHED', label: `Đang thực hiện ${s?.published ?? ''}` },
          { value: 'COMPLETED', label: `Hoàn thành ${s?.completed ?? ''}` },
        ]}
      />

      <T size={17} weight="bold">
        Do bạn tạo
      </T>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <T color={colors.muted} style={{ textAlign: 'center' }}>
            Chưa có sự kiện nào. Bấm “Tạo sự kiện” để bắt đầu.
          </T>
        </Card>
      ) : (
        data.items.map((e) => (
          <Card key={e.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T size={16} weight="bold" style={{ flex: 1 }}>
                {e.name}
              </T>
              <EventStatusBadge status={e.status} />
            </View>
            <T size={12} color={colors.muted}>
              {e.location} · {fmtDate(e.startsAt)} · {fmtRange(e.startsAt, e.endsAt)}
            </T>
            {e.status === 'DRAFT' ? (
              <T size={11} color={colors.muted}>
                Đã lưu nháp · Chưa phân công BTT
              </T>
            ) : (
              <>
                <T size={12}>
                  {e.progress.completed} / {e.progress.total} task hoàn thành
                </T>
                <ProgressBar value={e.progress.percent} />
                {e.progress.nextDeadline && (
                  <T size={11} color={colors.primary}>
                    Hạn gần nhất: {fmtDayTime(e.progress.nextDeadline.deadline)} · {e.progress.nextDeadline.taskTitle}
                  </T>
                )}
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={e.editable ? 'Sửa' : 'Đã diễn ra'}
                icon={e.editable ? 'edit' : undefined}
                variant="outline"
                disabled={!e.editable}
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/bch/event-form', params: { id: String(e.id) } })}
              />
              <Button title="Chi tiết" icon="eye" variant="outline" style={{ flex: 1 }} onPress={() => router.push(`/events/${e.id}`)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
