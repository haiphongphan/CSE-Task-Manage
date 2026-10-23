// Component nghiệp vụ dùng chung: nhãn trạng thái + thẻ nhắc nhở thông minh của BTT
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { EVENT_STATUS_LABEL, fmtDate, fmtDayTime, fmtRange, TASK_STATUS_LABEL, timeLeft } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventStatus, Reminders, Task } from '@/lib/types';
import { Badge, Button, Card, Icon, T } from './ui';

export function TaskStatusBadge({ task }: { task: Pick<Task, 'status' | 'isOverdue'> }) {
  if (task.isOverdue) return <Badge tone="navy">Quá hạn</Badge>;
  return <Badge tone={task.status === 'COMPLETED' ? 'outline' : 'ice'}>{TASK_STATUS_LABEL[task.status]}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={status === 'DRAFT' ? 'navy' : status === 'COMPLETED' ? 'outline' : 'ice'}>{EVENT_STATUS_LABEL[status]}</Badge>;
}

function useComplete(taskId: number, onDone: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const complete = async () => {
    setLoading(true);
    setError('');
    try {
      await api(`/tasks/${taskId}`, { method: 'PATCH', body: { status: 'COMPLETED' } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return { complete, loading, error };
}

/** Thẻ nhắc nhở (Figma: General Deadline Alert / Photographer Assignment / Post-Event Recap) */
export function ReminderCards({ data, onChanged }: { data: Reminders | null; onChanged: () => void }) {
  const [hideDeadline, setHideDeadline] = useState(false);
  if (!data) return null;
  const empty = !data.deadline.length && !data.photo.length && !data.recap.length;

  return (
    <View style={{ gap: 16 }}>
      {data.deadline.length > 0 && !hideDeadline && (
        <Card style={{ borderWidth: 2, borderColor: colors.primary, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="alert-circle" />
            </View>
            <View style={{ flex: 1 }}>
              <T size={15}>Cảnh báo hạn chót</T>
              <T size={10} color={colors.primary} upper>
                Tự động · trong 48 giờ tới
              </T>
            </View>
          </View>
          <T>{data.deadline.length} ấn phẩm cần bạn chú ý.</T>
          {data.deadline.map((t) => {
            const left = timeLeft(t.deadline);
            return (
              <View key={t.id} style={{ backgroundColor: colors.soft, borderRadius: 8, padding: 12, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T style={{ flex: 1 }}>{t.title}</T>
                  <Badge tone={left.overdue ? 'navy' : 'ice'}>{left.text}</Badge>
                </View>
                <T size={11} color={colors.muted}>
                  {t.event?.name} · {fmtDayTime(t.deadline)}
                </T>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Mở task" style={{ flex: 1 }} onPress={() => router.push(`/events/${data.deadline[0].eventId}`)} />
            <Button title="Đã hiểu" variant="outline" style={{ flex: 1 }} onPress={() => setHideDeadline(true)} />
          </View>
          <T size={10} color={colors.muted}>
            “Đã hiểu” chỉ ẩn thẻ này, không đánh dấu task hoàn thành.
          </T>
        </Card>
      )}

      {data.photo.map((r) => (
        <PhotoCard key={r.task.id} r={r} onDone={onChanged} />
      ))}
      {data.recap.map((r) => (
        <RecapCard key={r.task.id} r={r} onDone={onChanged} />
      ))}

      {empty && (
        <Card>
          <T color={colors.muted} style={{ textAlign: 'center' }}>
            Không có nhắc nhở nào. Mọi thứ đang đúng tiến độ!
          </T>
        </Card>
      )}
      <T size={11} color={colors.muted}>
        Nhắc nhở tự động gửi mỗi ngày lúc 08:00 cho tới khi task hoàn thành.
      </T>
    </View>
  );
}

function PhotoCard({ r, onDone }: { r: Reminders['photo'][number]; onDone: () => void }) {
  const { complete, loading, error } = useComplete(r.task.id, onDone);
  const when = r.daysUntilEvent > 0 ? `Sự kiện diễn ra sau ${r.daysUntilEvent} ngày.` : r.daysUntilEvent === 0 ? 'Sự kiện diễn ra hôm nay.' : 'Sự kiện đã diễn ra.';
  return (
    <Card dark style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Icon name="camera" size={18} color={colors.sky} />
        <Badge>Hằng ngày · Đang bật</Badge>
      </View>
      <T size={18} color={colors.white}>
        Nhắc phân công chụp ảnh
      </T>
      <T size={12} color={colors.white}>
        {r.event.name}
        {'\n'}
        {fmtDate(r.event.startsAt)} · {fmtRange(r.event.startsAt, r.event.endsAt)} · {r.event.location}
      </T>
      <T color={colors.white}>
        {when} Hãy xác nhận {r.event.photographerQuantity} người chụp ảnh cho toàn bộ sự kiện.
      </T>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
        <T size={10} color={colors.sky} upper>
          Trạng thái phân công
        </T>
        <T color={colors.white}>
          Cần {r.event.photographerQuantity} người · Phụ trách: {r.task.assignee?.fullName ?? 'cả nhóm'}
        </T>
      </View>
      <Button title="Đánh dấu hoàn thành" icon="check-circle" onPress={complete} loading={loading} />
      {error ? (
        <T size={11} color="#ffb4ab">
          {error}
        </T>
      ) : null}
      <T size={11} color="rgba(255,255,255,0.8)">
        Gửi mỗi ngày từ 3 ngày trước sự kiện. Đánh dấu hoàn thành để dừng nhắc.
      </T>
    </Card>
  );
}

function RecapCard({ r, onDone }: { r: Reminders['recap'][number]; onDone: () => void }) {
  const { complete, loading, error } = useComplete(r.task.id, onDone);
  const left = timeLeft(r.task.deadline);
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Icon name="file-text" size={18} />
        <Badge tone="navy">Hằng ngày · Còn nợ</Badge>
      </View>
      <T size={18}>Nhắc recap sau sự kiện</T>
      <T size={12} color={colors.muted}>
        {r.event.name} · đã kết thúc {fmtDayTime(r.event.endsAt)}
      </T>
      <T>Sự kiện đã kết thúc nhưng chưa có recap. Hãy đăng bài highlight và album ảnh.</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ice, borderRadius: 8, padding: 12 }}>
        <Icon name="clock" />
        <T size={12}>
          Hạn {fmtDayTime(r.task.deadline)} · {left.overdue ? 'Quá hạn' : left.text}
        </T>
      </View>
      <T size={11} color={colors.muted}>
        Phụ trách: {r.task.assignee?.fullName ?? 'Cả nhóm BTT'}
      </T>
      <Button title="Đã đăng recap / Hoàn thành" onPress={complete} loading={loading} />
      {error ? (
        <T size={11} color={colors.danger}>
          {error}
        </T>
      ) : null}
    </Card>
  );
}
