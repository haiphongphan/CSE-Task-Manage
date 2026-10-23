// Admin · Quản lý task (Figma: "Admin task management · Mobile")
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField, Select, TimeField } from '@/components/pickers';
import { TaskStatusBadge } from '@/components/shared';
import { Alert, Badge, Button, Card, Chips, Divider, ErrorBox, Field, Icon, Input, Loading, PageHeader, ProgressBar, Screen, StatCard, T } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { useRoleAllowed } from '@/lib/auth';
import { useOnTabActive } from '@/lib/workspace';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDayTime, fmtNow, fromInputs, PHASE_LABEL, TASK_STATUS_LABEL, timeLeft, toDateInput, toTimeInput } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventSummary, Task, TaskStatus } from '@/lib/types';

interface Resp {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  stats: { activeTasks: number; activeEvents: number; due48h: number; overdue: number; completionPercent: number; completed: number; total: number };
  events: EventSummary[];
}

const STATUS_OPTIONS = (Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }));

export default function AdminTasksScreen() {
  const ok = useRoleAllowed('ADMIN');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(ok ? `/tasks${qs({ search: q, status, page, pageSize: 10 })}` : null);
  useOnTabActive(reload); // mở lại tab -> tải lại ngầm
  const [selected, setSelected] = useState<Task | null>(null);
  const [notice, setNotice] = useState('');
  if (!ok) return <Loading />;
  const s = data?.stats;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Screen onRefresh={reload}>
      <PageHeader eyebrow="Quản trị / Tổng quan công việc" title="Quản lý task" description="Mọi sự kiện, mọi đội, một bức tranh rõ ràng." meta={fmtNow()} />
      <Button
        title="Gửi bản tin 09:00 ngay (demo)"
        variant="outline"
        icon="play"
        onPress={async () => {
          const r = await api<{ recipients: number; sent: number }>('/admin/run-digest', { method: 'POST' });
          setNotice(r.sent ? `Đã gửi bản tin (push + email) cho ${r.sent} thành viên BTT.` : 'Bản tin hôm nay đã được gửi trước đó, không gửi lại.');
        }}
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label="Task đang mở" value={s?.activeTasks ?? '–'} sub={`${s?.activeEvents ?? 0} sự kiện`} />
        <StatCard label="Hạn trong 48h" value={s?.due48h ?? '–'} sub={`${s?.overdue ?? 0} quá hạn`} />
        <StatCard label="Hoàn thành" value={s ? `${s.completionPercent}%` : '–'} sub={`${s?.completed ?? 0}/${s?.total ?? 0}`} />
      </View>

      <T size={17}>Tổng quan sự kiện</T>
      {data?.events.map((e) => (
        <Pressable key={e.id} onPress={() => router.push(`/events/${e.id}`)}>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Badge>{e.phase === 'POST_EVENT' && e.progress.recapPending ? 'Còn nợ recap' : PHASE_LABEL[e.phase]}</Badge>
              <Icon name="arrow-up-right" />
            </View>
            <T size={15}>{e.name}</T>
            <T size={11} color={colors.muted}>
              {fmtDayTime(e.startsAt)} · {e.location}
            </T>
            <T size={12}>{e.progress.percent}% hoàn thành</T>
            <ProgressBar value={e.progress.percent} />
          </Card>
        </Pressable>
      ))}

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={17}>Tất cả task</T>
          <Badge>{data?.total ?? 0} task</Badge>
        </View>
        <Input value={search} onChangeText={(v) => (setSearch(v), setPage(1))} placeholder="Tìm task hoặc sự kiện" icon="search" />
        <Chips
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          options={[{ value: '', label: 'Tất cả' }, ...STATUS_OPTIONS, { value: 'OVERDUE', label: 'Quá hạn' }]}
        />
        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : (
          data?.items.map((t) => (
            <Pressable key={t.id} onPress={() => setSelected(t)} style={{ gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.divider }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T style={{ flex: 1 }}>{t.title}</T>
                <TaskStatusBadge task={t} />
              </View>
              <T size={11} color={colors.muted}>
                {t.event?.name} · {t.code} · {t.team?.length ? t.team.map((m) => m.fullName).join(', ') : 'Chưa phân công'}
              </T>
              <T size={11} color={colors.primary}>
                {fmtDayTime(t.deadline)} · {t.status === 'COMPLETED' ? 'Đã xong' : timeLeft(t.deadline).text}
              </T>
              <ProgressBar value={t.progress} />
            </Pressable>
          ))
        )}
        {data && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={11} color={colors.muted}>
              Trang {page}/{pages}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="outline" title="Trước" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Button small variant="outline" title="Sau" disabled={page >= pages} onPress={() => setPage(page + 1)} />
            </View>
          </View>
        )}
      </Card>

      {selected && (
        <TaskEditor
          task={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setNotice('Đã lưu task. Người nhận đã được thông báo.');
            void reload();
          }}
        />
      )}
    </Screen>
  );
}

function TaskEditor({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: task.title,
    date: toDateInput(task.deadline),
    time: toTimeInput(task.deadline),
    status: task.status,
    progress: task.progress,
    notes: task.notes ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          deadline: fromInputs(form.date, form.time),
          status: form.status,
          progress: form.progress,
          notes: form.notes || null,
        },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T size={20}>Sửa chi tiết task</T>
                <T size={11} color={colors.muted}>
                  {task.event?.name} · {task.code}
                </T>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Đóng">
                <Icon name="x" size={20} />
              </Pressable>
            </View>
            <Divider />
            <Field label="Tên task *">
              <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} autoCapitalize="sentences" />
            </Field>
            <Field label="BTT phụ trách (cả nhóm)">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {task.team?.length ? task.team.map((m) => <Badge key={m.id}>{m.fullName}</Badge>) : <T size={12} color={colors.muted}>Sự kiện chưa phân công BTT</T>}
              </View>
            </Field>
            <Field label="Hạn chót *">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 3 }}>
                  <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} title="Hạn chót" />
                </View>
                <View style={{ flex: 2 }}>
                  <TimeField value={form.time} onChange={(v) => setForm({ ...form, time: v })} title="Giờ hạn chót" />
                </View>
              </View>
            </Field>
            <Field label="Trạng thái *">
              <Select value={form.status} options={STATUS_OPTIONS} onChange={(v) => setForm({ ...form, status: v })} title="Trạng thái task" />
            </Field>
            <Field label={`Tiến độ · ${form.status === 'COMPLETED' ? 100 : form.progress}%`}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[0, 25, 50, 75, 90, 100].map((p) => (
                  <Pressable
                    key={p}
                    disabled={form.status === 'COMPLETED'}
                    onPress={() => setForm({ ...form, progress: p })}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: form.progress === p ? colors.primary : colors.white }}
                  >
                    <T size={12} color={form.progress === p ? colors.white : colors.primary}>
                      {p}%
                    </T>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="Ghi chú (tuỳ chọn)">
              <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline autoCapitalize="sentences" />
            </Field>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button title="Lưu thay đổi" icon="check" onPress={save} loading={saving} />
            <T size={11} color={colors.muted}>
              Thay đổi sẽ thông báo cho người nhận và cập nhật nhắc nhở.
            </T>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
