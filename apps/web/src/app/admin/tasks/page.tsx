'use client';
// Admin · Quản lý task (Figma: "Admin task management")
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpRight, CalendarDays, Check, Clock, Download, ListChecks, PenSquare, Search, TrendingUp, Play } from 'lucide-react';
import { Alert, Badge, Button, Empty, ErrorBox, Field, Loading, PageHeader, ProgressBar, StatCard, cx } from '@/components/ui';
import { TaskStatusBadge } from '@/components/status';
import { DatePicker, Dropdown, TimePicker } from '@/components/pickers';
import { API_URL, api, qs, tokenStore } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDayTime, fmtNow, fromInputs, PHASE_LABEL, TASK_STATUS_LABEL, timeLeft, toDateInput, toTimeInput } from '@/lib/format';
import type { EventSummary, Task, TaskStatus } from '@/lib/types';

interface TasksResponse {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  stats: { activeTasks: number; activeEvents: number; due48h: number; overdue: number; completionPercent: number; completed: number; total: number };
  events: EventSummary[];
}

export default function AdminTasksPage() {
  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState<number | ''>('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'deadline_asc' | 'deadline_desc'>('deadline_asc');
  const [page, setPage] = useState(1);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<TasksResponse>(`/tasks${qs({ search: q, eventId, status, sort, page, pageSize: 10 })}`);
  const [selected, setSelected] = useState<Task | null>(null);
  const [notice, setNotice] = useState('');

  // Giữ panel bên phải đồng bộ với dữ liệu mới nhất
  useEffect(() => {
    if (!data) return;
    setSelected((cur) => (cur ? (data.items.find((t) => t.id === cur.id) ?? cur) : (data.items[0] ?? null)));
  }, [data]);

  async function exportCsv() {
    const res = await fetch(`${API_URL}/tasks/export.csv`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tong-quan-task.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function runDigest() {
    const r = await api<{ recipients: number; sent: number; resent: number }>('/admin/run-digest', { method: 'POST' });
    const parts: string[] = [];
    if (r.sent) parts.push(`đã gửi bản tin mới cho ${r.sent} thành viên BTT`);
    if (r.resent) parts.push(`đã đẩy lại cho ${r.resent} người trước đó chưa nhận được trên điện thoại`);
    setNotice(
      parts.length
        ? `Bản tin hằng ngày: ${parts.join('; ')}.`
        : `${r.recipients} BTT có task cần làm; bản tin hôm nay đều đã tới thiết bị (hoặc người nhận chưa bật thông báo) nên không gửi lại.`,
    );
  }

  const stats = data?.stats;
  const events = data ? (showAllEvents ? data.events : data.events.slice(0, 3)) : [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Quản trị / Tổng quan công việc"
        title="Quản lý task"
        description="Mọi sự kiện, mọi đội, một bức tranh rõ ràng."
        meta={
          <>
            <CalendarDays className="size-4 text-primary" /> {fmtNow()}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Play className="size-4" />} onClick={runDigest} title="Gửi bản tin 09:00 ngay bây giờ (demo)">
              Gửi bản tin ngay
            </Button>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv}>
              Xuất tổng quan
            </Button>
          </div>
        }
      />
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Task đang mở" value={stats?.activeTasks ?? '–'} sub={`Thuộc ${stats?.activeEvents ?? 0} sự kiện`} icon={<ListChecks className="size-[18px]" />} />
        <StatCard label="Hạn trong 48 giờ" value={stats?.due48h ?? '–'} sub={`${stats?.overdue ?? 0} task đã quá hạn`} icon={<Clock className="size-[18px]" />} />
        <StatCard
          label="Tỉ lệ hoàn thành"
          value={stats ? `${stats.completionPercent}%` : '–'}
          sub={`${stats?.completed ?? 0} / ${stats?.total ?? 0} task đã xong`}
          icon={<TrendingUp className="size-[18px]" />}
        />
      </div>

      {/* Tổng quan sự kiện */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-navy">Tổng quan sự kiện</h2>
          {data && data.events.length > 3 && (
            <button className="text-xs text-primary" onClick={() => setShowAllEvents(!showAllEvents)}>
              {showAllEvents ? 'Thu gọn' : `Xem tất cả ${data.events.length} →`}
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card flex flex-col gap-3 p-4 transition hover:border-primary">
              <div className="flex items-start justify-between">
                <Badge>{e.progress.recapPending && e.phase === 'POST_EVENT' ? 'Còn nợ recap' : PHASE_LABEL[e.phase]}</Badge>
                <ArrowUpRight className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-[15px] text-navy">{e.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {fmtDayTime(e.startsAt)} · {e.location}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-navy">{e.progress.percent}% hoàn thành</span>
                <ProgressBar value={e.progress.percent} />
              </div>
              <p className="text-[11px] text-muted">
                {e.progress.completed} / {e.progress.total} task xong · {e.members.length} BTT phụ trách
              </p>
            </Link>
          ))}
          {data && data.events.length === 0 && <Empty>Chưa có sự kiện nào đang thực hiện</Empty>}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* Danh sách task */}
        <section className="card flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-navy">Tất cả task</h2>
            <Badge>{data?.total ?? 0} task</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
            <input
              className="input !bg-soft pl-9"
              placeholder="Tìm task, mã task hoặc sự kiện"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Dropdown
              size="sm"
              className="w-52"
              width={260}
              value={eventId}
              onChange={(v) => (setEventId(v), setPage(1))}
              options={[{ value: '' as const, label: 'Tất cả sự kiện' }, ...(data?.events ?? []).map((e) => ({ value: e.id, label: e.name }))]}
            />
            <Dropdown
              size="sm"
              className="w-44"
              value={status}
              onChange={(v) => (setStatus(v), setPage(1))}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                ...(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s as string, label: TASK_STATUS_LABEL[s] })),
                { value: 'OVERDUE', label: 'Quá hạn' },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              icon={sort === 'deadline_asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              onClick={() => setSort(sort === 'deadline_asc' ? 'deadline_desc' : 'deadline_asc')}
            >
              Hạn chót
            </Button>
          </div>

          {error ? (
            <ErrorBox message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Loading />
          ) : data?.items.length === 0 ? (
            <Empty>Không có task phù hợp</Empty>
          ) : (
            <div className="flex flex-col">
              <div className="hidden grid-cols-[1fr_130px_120px_110px] gap-3 bg-soft px-3 py-3 text-[11px] uppercase text-navy md:grid">
                <span>Task / Sự kiện</span>
                <span>BTT phụ trách</span>
                <span>Hạn chót</span>
                <span>Trạng thái</span>
              </div>
              {data?.items.map((t) => {
                const left = timeLeft(t.deadline);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cx(
                      'grid grid-cols-2 gap-3 border-b border-divider px-3 py-4 text-left transition md:grid-cols-[1fr_130px_120px_110px]',
                      selected?.id === t.id ? 'rounded-lg border border-primary bg-soft' : 'hover:bg-soft/60',
                    )}
                  >
                    <span className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                      <span className="text-[13px] text-navy">{t.title}</span>
                      <span className="text-[11px] text-muted">
                        {t.event?.name} · {t.code}
                      </span>
                      <ProgressBar value={t.progress} />
                    </span>
                    <span className="text-xs text-navy">{t.team?.length ? t.team.map((m) => m.fullName).join(', ') : 'Chưa phân công'}</span>
                    <span className="text-xs text-navy">
                      {fmtDayTime(t.deadline)}
                      <span className="block text-[11px] text-primary">{t.status === 'COMPLETED' ? 'Đã xong' : left.text}</span>
                    </span>
                    <span className="flex flex-col items-start gap-1.5">
                      <TaskStatusBadge task={t} />
                      <span className="flex items-center gap-1 text-[11px] text-primary">
                        <PenSquare className="size-3" /> Sửa
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {data && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                Trang {page}/{totalPages} · {data.total} task · Sắp theo hạn chót
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Trước
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Sau
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Panel sửa task */}
        <aside className="lg:sticky lg:top-28">
          {selected ? (
            <TaskEditor key={selected.id + selected.updatedAt} task={selected} onSaved={reload} />
          ) : (
            <div className="card p-6 text-sm text-muted">Chọn một task để chỉnh sửa</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TaskEditor({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: task.title,
    date: toDateInput(task.deadline),
    time: toTimeInput(task.deadline),
    status: task.status,
    progress: task.progress,
    notes: task.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          deadline: fromInputs(form.date, form.time),
          status: form.status,
          progress: Number(form.progress),
          notes: form.notes || null,
        },
      });
      setMsg({ tone: 'success', text: 'Đã lưu. Nhóm BTT phụ trách đã được thông báo.' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg text-navy">Sửa chi tiết task</h2>
        <p className="mt-1 text-xs text-muted">
          {task.event?.name} · {task.code}
        </p>
      </div>
      <Badge tone="navy" className="self-start">
        Task đang chọn
      </Badge>
      <Field label="Tên task *">
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="label">BTT phụ trách (cả nhóm)</span>
        <div className="flex flex-wrap gap-1">
          {task.team?.length ? task.team.map((m) => <Badge key={m.id}>{m.fullName}</Badge>) : <span className="hint">Sự kiện chưa phân công BTT</span>}
        </div>
      </div>
      <Field custom label="Hạn chót *">
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          <TimePicker value={form.time} onChange={(v) => setForm({ ...form, time: v })} />
        </div>
      </Field>
      <Field custom label="Trạng thái *">
        <Dropdown
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
        />
      </Field>
      <Field label={`Tiến độ * · ${form.status === 'COMPLETED' ? 100 : form.progress}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="accent-primary"
          disabled={form.status === 'COMPLETED'}
          value={form.status === 'COMPLETED' ? 100 : form.progress}
          onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
        />
      </Field>
      <Field label="Ghi chú (tuỳ chọn)">
        <textarea className="input min-h-[90px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button onClick={save} loading={saving} icon={<Check className="size-4" />}>
        Lưu thay đổi
      </Button>
      <p className="text-[11px] text-muted">Thay đổi sẽ thông báo cho người nhận và cập nhật nhắc nhở.</p>
    </div>
  );
}
