// Danh sách sự kiện (Figma: "BCH event list · Mobile")
//   BCH  : "Sự kiện của tôi" — chỉ sửa khi sự kiện chưa diễn ra
//   ADMIN: "Quản lý sự kiện" — mọi sự kiện, sửa bất kỳ lúc nào (dùng qua screens/AdminEvents.tsx)
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EventStatusBadge } from '@/components/shared';
import { Alert, Button, Card, Chips, ErrorBox, Input, Loading, PageHeader, ProgressBar, Screen, StatCard, T } from '@/components/ui';
import { qs } from '@/lib/api';
import { useAuth, useRoleAllowed } from '@/lib/auth';
import { takeFlash } from '@/lib/flash';
import { setTab, useOnTabActive } from '@/lib/workspace';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDayTime, fmtNow, fmtSchedule } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventStatus, EventSummary } from '@/lib/types';

interface Resp {
  items: EventSummary[];
  stats: { total: number; draft: number; published: number; completed: number };
}

export default function BchEventsScreen() {
  return <EventsList mode="BCH" />;
}

export function EventsList({ mode }: { mode: 'BCH' | 'ADMIN' }) {
  const isAdmin = mode === 'ADMIN';
  const ok = useRoleAllowed(mode);
  const { user } = useAuth();
  const [status, setStatus] = useState<'' | EventStatus>('');
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(ok ? `/events${qs({ status, search: q })}` : null);

  // Quay lại màn này (sau khi tạo/sửa) -> tải lại + hiện thông báo
  // Mở lại tab / quay về từ màn sửa -> hiện lời nhắn (nếu có) + tải lại ngầm
  useOnTabActive(() => {
    const f = takeFlash();
    if (f) setFlash(f);
    void reload();
  });

  if (!ok) return <Loading />;
  const s = data?.stats;

  return (
    <Screen onRefresh={reload}>
      <PageHeader
        eyebrow={isAdmin ? 'Admin / Quản trị' : 'BCH / Ban Chấp hành'}
        title={isAdmin ? 'Quản lý sự kiện' : 'Sự kiện của tôi'}
        description={isAdmin ? 'Xem và chỉnh sửa mọi sự kiện của các BCH.' : 'Quản lý brief, phân công và tiến độ sự kiện.'}
      />
      {!isAdmin && <Button title="Tạo sự kiện" icon="plus" onPress={() => setTab('bch/new')} style={{ alignSelf: 'flex-start' }} />}
      <T size={11} color={colors.muted}>
        {user?.fullName} · {isAdmin ? 'Admin' : 'Ban Chấp hành'} · {fmtNow()}
      </T>
      {flash && <Alert tone="success">✓ {flash}</Alert>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label={isAdmin ? 'Tổng sự kiện' : 'Sự kiện của tôi'} value={s?.total ?? '–'} />
        <StatCard label="Nháp" value={s?.draft ?? '–'} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: -10 }}>
        <StatCard label="Đang thực hiện" value={s?.published ?? '–'} />
        <StatCard label="Hoàn thành" value={s?.completed ?? '–'} />
      </View>

      <Input value={search} onChangeText={setSearch} placeholder={isAdmin ? 'Tìm theo tên sự kiện' : 'Tìm sự kiện của bạn'} icon="search" light />
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
        {isAdmin ? 'Tất cả sự kiện' : 'Do bạn tạo'}
      </T>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <T color={colors.muted} style={{ textAlign: 'center' }}>
            {isAdmin ? 'Chưa có sự kiện nào.' : 'Chưa có sự kiện nào. Bấm “Tạo sự kiện” để bắt đầu.'}
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
              {e.location} · {fmtSchedule(e.sessions)}
            </T>
            {isAdmin && (
              <T size={11} color={colors.primary}>
                Tạo bởi BCH {e.createdBy?.fullName}
              </T>
            )}
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
                title={isAdmin || e.editable ? 'Sửa' : 'Đã diễn ra'}
                icon={isAdmin || e.editable ? 'edit' : undefined}
                variant="outline"
                disabled={!isAdmin && !e.editable}
                style={{ flex: 1 }}
                onPress={() => router.push(`/bch/edit/${e.id}`)}
              />
              <Button title="Chi tiết" icon="eye" variant="outline" style={{ flex: 1 }} onPress={() => router.push(`/events/${e.id}`)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
