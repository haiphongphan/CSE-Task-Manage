// Chi tiết sự kiện — mọi vai trò (Figma: "BTT tracking and smart reminders · Mobile")
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EventStatusBadge, ReminderCards, TaskStatusBadge } from '@/components/shared';
import { Select } from '@/components/pickers';
import { Alert, Badge, Button, Card, Chips, Divider, ErrorBox, Icon, Loading, PageHeader, ProgressBar, Screen, StatCard, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { openTab } from '@/lib/workspace';
import { fmtDate, fmtDayTime, fmtRange, PHASE_LABEL, TASK_STATUS_LABEL, timeLeft } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { Activity, EventDetail, Reminders, Task, TaskStatus } from '@/lib/types';

const PROGRESS_FOR: Record<TaskStatus, (cur: number) => number> = {
  TODO: () => 0,
  IN_PROGRESS: (cur) => (cur > 0 && cur < 90 ? cur : 50),
  IN_REVIEW: () => 90,
  COMPLETED: () => 100,
};
const STATUS_OPTIONS = (Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }));

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isBtt = user?.role === 'BTT';
  const { data, error, loading, reload } = useApi<{ event: EventDetail; activity: Activity[] }>(`/events/${id}`);
  const reminders = useApi<Reminders>(isBtt ? '/reminders' : null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (error) return <Screen><ErrorBox message={error} onRetry={reload} /></Screen>;
  if (loading || !data || !user) return <Loading />;
  const { event: e, activity } = data;
  const refreshAll = () => {
    void reload();
    void reminders.reload();
  };

  const deliverables = e.tasks.filter((t) => t.type !== 'PHOTOGRAPHER' && t.type !== 'RECAP');
  const special = e.tasks.filter((t) => t.type === 'PHOTOGRAPHER' || t.type === 'RECAP');
  const done = deliverables.filter((t) => t.status === 'COMPLETED').length;
  const shown = deliverables.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.status === 'COMPLETED' : t.status !== 'COMPLETED'));
  // Task giao cho cả nhóm BTT -> mọi task chưa xong đều là việc của nhóm
  const myOpen = e.tasks.filter((t) => t.status !== 'COMPLETED');
  const next = myOpen.filter((t) => !t.isOverdue).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  return (
    <Screen onRefresh={refreshAll}>
      <PageHeader
        eyebrow={user.role === 'BTT' ? 'BTT / Ban Truyền thông' : user.role === 'BCH' ? 'BCH / Ban Chấp hành' : 'Quản trị'}
        title={e.name}
        description={`${fmtDate(e.startsAt)} · ${fmtRange(e.startsAt, e.endsAt)} · ${e.location}`}
      />
      {isBtt && <Button title={`Nhắc nhở thông minh · ${reminders.data?.total ?? 0}`} variant="outline" icon="bell" onPress={() => openTab('btt/reminders')} />}
      {e.permissions.canEdit && user.role === 'BCH' && (
        <Button title="Sửa sự kiện" icon="edit" onPress={() => router.push(`/bch/edit/${e.id}`)} />
      )}
      <Button title="Về danh sách" variant="outline" icon="arrow-left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label={isBtt ? 'Task nhóm còn mở' : 'Task đang mở'} value={myOpen.length} sub={`${e.progress.overdue} quá hạn`} />
        <StatCard label="Hạn tiếp theo" value={next ? timeLeft(next.deadline).text.replace('còn ', '') : '–'} sub={next?.title} />
      </View>

      <Card dark style={{ gap: 8 }}>
        <T size={11} color={colors.sky} upper>
          Chi tiết sự kiện
        </T>
        <T size={22} weight="bold" color={colors.white}>
          {e.name}
        </T>
        <T size={12} color={colors.white}>
          {fmtDate(e.startsAt)} · {fmtRange(e.startsAt, e.endsAt)} · {e.location}
        </T>
        <T size={11} color={colors.sky}>
          Tạo bởi {e.createdBy?.fullName} · BCH
        </T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <EventStatusBadge status={e.status} />
          <Badge>{PHASE_LABEL[e.phase]}</Badge>
        </View>
        <T size={20} color={colors.white}>
          {e.progress.completed} / {e.progress.total} hoàn thành
        </T>
        <T size={11} color="rgba(255,255,255,0.8)">
          BTT phụ trách: {e.members.map((m) => m.fullName).join(', ') || 'chưa phân công'}
        </T>
      </Card>

      {isBtt && <ReminderCards data={reminders.data} onChanged={refreshAll} />}

      <Card style={{ gap: 12 }}>
        <T size={17}>Ấn phẩm & hạn chót</T>
        <T size={12} color={colors.muted}>
          Yêu cầu từ BCH · {e.permissions.canUpdateTasks ? 'Cập nhật trạng thái khi công việc tiến triển.' : 'Theo dõi tiến độ của BTT.'}
        </T>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Tất cả ${deliverables.length}` },
            { value: 'open', label: `Chưa xong ${deliverables.length - done}` },
            { value: 'done', label: `Đã xong ${done}` },
          ]}
        />
        {shown.map((t) => (
          <TaskItem key={t.id} task={t} event={e} onChanged={refreshAll} setNotice={setNotice} />
        ))}
        {special.map((t) => (
          <View key={t.id} style={{ backgroundColor: colors.soft, borderRadius: 10, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={t.type === 'PHOTOGRAPHER' ? 'camera' : 'file-text'} />
              <T style={{ flex: 1 }}>{t.title}</T>
            </View>
            <T size={11} color={colors.muted}>
              {t.type === 'PHOTOGRAPHER' ? `${e.photographerQuantity} người chụp · ${fmtDate(e.startsAt)} · ${e.location}` : `Hạn recap ${fmtDayTime(t.deadline)} (7 ngày sau sự kiện)`}
            </T>
            <TaskActions task={t} event={e} onChanged={refreshAll} setNotice={setNotice} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        <T size={17}>Ghi chú sự kiện & brief recap</T>
        <T>{e.notes || 'Chưa có ghi chú.'}</T>
        <Divider />
        <ContentBox title="Nội dung ấn phẩm online" text={e.onlineContent} />
        <ContentBox title="Nội dung ấn phẩm in ấn" text={e.offlineContent} />
      </Card>

      <Card style={{ gap: 12 }}>
        <T size={17}>Hoạt động gần đây</T>
        {activity.length === 0 && <T color={colors.muted}>Chưa có hoạt động.</T>}
        {activity.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: 10 }}>
            <Icon name={a.message.includes('hoàn thành') ? 'check-circle' : 'message-square'} />
            <View style={{ flex: 1 }}>
              <T>{a.message}</T>
              <T size={10} color={colors.muted}>
                {fmtDayTime(a.createdAt)}
              </T>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

type SetNotice = (n: { tone: 'success' | 'error'; text: string } | null) => void;

function TaskItem({ task: t, event, onChanged, setNotice }: { task: Task; event: EventDetail; onChanged: () => void; setNotice: SetNotice }) {
  const left = timeLeft(t.deadline);
  return (
    <View style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 10, padding: 12, gap: 6 }}>
      <T size={15}>{t.title}</T>
      <T size={11} color={colors.muted}>
        {t.dimensions ?? 'Không yêu cầu kích thước'}
      </T>
      <T size={12} color={colors.primary}>
        {t.status === 'COMPLETED' && t.completedAt ? `Đã nộp ${fmtDayTime(t.completedAt)}${t.completedBy ? ` · ${t.completedBy.fullName}` : ''}` : left.text}
      </T>
      <T size={11} color={colors.muted}>
        Hạn {fmtDayTime(t.deadline)}
      </T>
      <TaskActions task={t} event={event} onChanged={onChanged} setNotice={setNotice} />
      <T size={11}>{t.progress}% hoàn thành</T>
      <ProgressBar value={t.progress} />
    </View>
  );
}

function TaskActions({ task: t, event, onChanged, setNotice }: { task: Task; event: EventDetail; onChanged: () => void; setNotice: SetNotice }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setNotice({ tone: 'success', text: await fn() });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {event.permissions.canUpdateTasks ? (
        <View style={{ minWidth: 150 }}>
          <Select
            compact
            title={`Trạng thái · ${t.title}`}
            value={t.status}
            disabled={busy}
            options={STATUS_OPTIONS}
            onChange={(status) =>
              run(async () => {
                await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status, progress: PROGRESS_FOR[status](t.progress) } });
                return `Đã cập nhật “${t.title}”: ${TASK_STATUS_LABEL[status]}.`;
              })
            }
          />
        </View>
      ) : (
        <TaskStatusBadge task={t} />
      )}
      {event.permissions.canRemind && t.status !== 'COMPLETED' && (
        <Button
          small
          variant="outline"
          icon="bell"
          title="Nhắc"
          loading={busy}
          onPress={() =>
            run(async () => {
              const r = await api<{ sent: number }>(`/tasks/${t.id}/remind`, { method: 'POST', body: {} });
              return `Đã gửi nhắc “${t.title}” tới ${r.sent} người.`;
            })
          }
        />
      )}
    </View>
  );
}

function ContentBox({ title, text }: { title: string; text: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <T>{title}</T>
      <View style={{ backgroundColor: colors.soft, borderRadius: 8, padding: 12 }}>
        <T size={12}>{text || '—'}</T>
      </View>
      {text ? (
        <Button
          small
          variant="outline"
          icon="copy"
          title={copied ? 'Đã sao chép' : 'Sao chép nội dung'}
          style={{ alignSelf: 'flex-start' }}
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
      ) : null}
    </View>
  );
}
