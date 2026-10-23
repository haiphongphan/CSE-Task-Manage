'use client';
// Chi tiết sự kiện — dùng chung cho mọi vai trò (Figma: "BTT tracking and smart reminders")
//   BTT  : đổi trạng thái task, xem nhắc nhở thông minh
//   BCH  : xem tiến độ, bấm "Nhắc" từng task, sửa sự kiện (nếu chưa diễn ra)
//   Admin: xem tổng quan
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  ListChecks,
  MessageSquare,
  PenSquare,
  Timer,
  Users,
} from 'lucide-react';
import { Alert, Avatar, Badge, Button, Chips, ErrorBox, Loading, PageHeader, ProgressBar, StatCard, cx } from '@/components/ui';
import { EventStatusBadge, TaskStatusBadge } from '@/components/status';
import { ReminderCards } from '@/components/ReminderCards';
import { Dropdown } from '@/components/pickers';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDayTime, fmtNow, fmtRange, PHASE_LABEL, TASK_STATUS_LABEL, timeLeft } from '@/lib/format';
import type { Activity, EventDetail, Reminders, Task, TaskStatus } from '@/lib/types';

/** Tiến độ gợi ý khi BTT đổi trạng thái */
const PROGRESS_FOR: Record<TaskStatus, (cur: number) => number> = {
  TODO: () => 0,
  IN_PROGRESS: (cur) => (cur > 0 && cur < 90 ? cur : 50),
  IN_REVIEW: () => 90,
  COMPLETED: () => 100,
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<{ event: EventDetail; activity: Activity[] }>(`/events/${id}`);
  const isBtt = user?.role === 'BTT';
  const reminders = useApi<Reminders>(isBtt ? '/reminders' : null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data || !user) return <Loading />;
  const { event: e, activity } = data;

  const refreshAll = () => {
    void reload();
    void reminders.reload();
  };

  // Task giao cho cả nhóm BTT -> mọi task chưa xong đều là việc của nhóm
  const myOpen = e.tasks.filter((t) => t.status !== 'COMPLETED');
  const next = myOpen.filter((t) => !t.isOverdue).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const deliverables = e.tasks.filter((t) => t.type !== 'PHOTOGRAPHER' && t.type !== 'RECAP');
  const special = e.tasks.filter((t) => t.type === 'PHOTOGRAPHER' || t.type === 'RECAP');
  const shown = deliverables.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.status === 'COMPLETED' : t.status !== 'COMPLETED'));
  const doneCount = deliverables.filter((t) => t.status === 'COMPLETED').length;

  const backHref = user.role === 'ADMIN' ? '/admin/tasks' : user.role === 'BCH' ? '/bch/events' : '/btt/events';
  const eyebrow = user.role === 'ADMIN' ? 'Quản trị / Chi tiết sự kiện' : user.role === 'BCH' ? 'BCH / Ban Chấp hành' : 'BTT / Ban Truyền thông';

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={eyebrow}
        title={e.name}
        description="Chi tiết sự kiện: ấn phẩm, hạn chót và nhắc nhở."
        meta={
          <>
            <Clock className="size-4 text-primary" /> {fmtNow()}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isBtt && (
              <Link href="/btt/reminders">
                <Button variant="outline" icon={<Bell className="size-4" />}>
                  Nhắc nhở thông minh · {reminders.data?.total ?? 0}
                </Button>
              </Link>
            )}
            {e.permissions.canEdit && user.role === 'BCH' && (
              <Link href={`/bch/events/${e.id}/edit`}>
                <Button icon={<PenSquare className="size-4" />}>Sửa sự kiện</Button>
              </Link>
            )}
          </div>
        }
      />
      <Link href={backHref} className="self-start">
        <Button variant="outline" icon={<ArrowLeft className="size-4" />}>
          Về danh sách
        </Button>
      </Link>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={isBtt ? 'Task nhóm còn mở' : 'Task đang mở'}
          value={myOpen.length}
          sub={`${e.progress.overdue} quá hạn`}
          icon={<ListChecks className="size-[18px]" />}
        />
        <StatCard
          label="Hạn tiếp theo"
          value={next ? timeLeft(next.deadline).text.replace('còn ', '') : '–'}
          sub={next ? next.title : 'Không còn hạn nào sắp tới'}
          icon={<Timer className="size-[18px]" />}
        />
        {isBtt ? (
          <StatCard
            label="Nhắc nhở thông minh"
            value={reminders.data?.total ?? 0}
            sub={`${reminders.data?.photo.length ?? 0} chụp ảnh · ${reminders.data?.recap.length ?? 0} recap`}
            icon={<BellRing className="size-[18px]" />}
          />
        ) : (
          <StatCard label="BTT phụ trách" value={e.members.length} sub={e.members.map((m) => m.fullName).join(', ') || 'Chưa phân công'} icon={<Users className="size-[18px]" />} />
        )}
      </div>

      {/* Khối navy tóm tắt */}
      <section className="flex flex-col gap-5 rounded-xl bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase text-sky">Chi tiết sự kiện</p>
          <h2 className="mt-2 text-2xl font-bold">{e.name}</h2>
          <p className="mt-2 text-xs text-white/90">
            {fmtDate(e.startsAt)} · {fmtRange(e.startsAt, e.endsAt)} · {e.location}
          </p>
          <p className="mt-1 text-[11px] text-sky">
            Tạo bởi {e.createdBy?.fullName} · BCH {e.publishedAt && `· Gửi ngày ${fmtDate(e.publishedAt)}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex gap-2">
            <EventStatusBadge status={e.status} />
            <Badge>{PHASE_LABEL[e.phase]}</Badge>
          </div>
          <p className="text-xl">
            {e.progress.completed} / {e.progress.total} hoàn thành
          </p>
          <p className="text-[11px] text-white/80">
            {deliverables.length} ấn phẩm{e.photographerNeeded ? ` + ${e.photographerQuantity} người chụp ảnh` : ''} + recap
          </p>
        </div>
      </section>

      <div className={cx('grid items-start gap-6', 'lg:grid-cols-[1fr_340px]')}>
        <div className="flex flex-col gap-6">
          {/* Ấn phẩm & hạn chót */}
          <section className="card flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-lg text-navy">Ấn phẩm & hạn chót</h2>
              <p className="text-xs text-muted">
                Yêu cầu từ BCH · {e.permissions.canUpdateTasks ? 'Cập nhật trạng thái khi công việc tiến triển.' : 'Theo dõi tiến độ của BTT.'}
              </p>
            </div>
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `Tất cả ${deliverables.length}` },
                { value: 'open', label: `Chưa xong ${deliverables.length - doneCount}` },
                { value: 'done', label: `Đã xong ${doneCount}` },
              ]}
            />
            <div className="flex flex-col">
              {shown.map((t) => (
                <TaskRow key={t.id} task={t} event={e} onChanged={refreshAll} setNotice={setNotice} />
              ))}
              {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Không có ấn phẩm nào</p>}
            </div>
            {special.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl bg-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-navy">
                    {t.type === 'PHOTOGRAPHER' ? <Camera className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                    {t.title}
                  </span>
                  {t.isOverdue && <TaskStatusBadge task={t} />}
                </div>
                <p className="text-xs text-muted">
                  {t.type === 'PHOTOGRAPHER'
                    ? `${e.photographerQuantity} người chụp · ${fmtDate(e.startsAt)} · ${fmtRange(e.startsAt, e.endsAt)} · ${e.location}`
                    : `Hạn recap ${fmtDayTime(t.deadline)} (7 ngày sau sự kiện)`}
                </p>
                <TaskActions task={t} event={e} onChanged={refreshAll} setNotice={setNotice} />
              </div>
            ))}
          </section>

          {/* Ghi chú & nội dung */}
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="text-lg text-navy">Ghi chú sự kiện & brief recap</h2>
            <p className="whitespace-pre-line text-[13px] text-navy">{e.notes || 'Chưa có ghi chú.'}</p>
            <div className="h-px bg-divider" />
            <div className="grid gap-4 md:grid-cols-2">
              <ContentBox title="Nội dung ấn phẩm online" text={e.onlineContent} />
              <ContentBox title="Nội dung ấn phẩm in ấn" text={e.offlineContent} />
            </div>
          </section>

          {/* Hoạt động */}
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="text-lg text-navy">Hoạt động gần đây</h2>
            {activity.length === 0 && <p className="text-sm text-muted">Chưa có hoạt động.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                {a.message.includes('hoàn thành') ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                )}
                <div>
                  <p className="text-[13px] text-navy">{a.message}</p>
                  <p className="text-[10px] text-muted">{fmtDayTime(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Cột phải */}
        <aside className="flex flex-col gap-4">
          {isBtt ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg text-navy">Nhắc nhở thông minh</h2>
                <span className="text-[11px] text-muted">{reminders.data?.total ?? 0} đang bật</span>
              </div>
              <ReminderCards data={reminders.data} onChanged={refreshAll} />
            </>
          ) : (
            <div className="card flex flex-col gap-3 p-5">
              <h2 className="text-lg text-navy">BTT phụ trách</h2>
              {e.members.length === 0 && <p className="text-sm text-muted">Chưa phân công (bản nháp).</p>}
              {e.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.fullName} size={30} />
                  <div className="flex-1">
                    <p className="text-[13px] text-navy">{m.fullName}</p>
                    <p className="text-[11px] text-muted">Ban Truyền thông · cùng phụ trách mọi task</p>
                  </div>
                </div>
              ))}
              {e.members.length > 0 && (
                <p className="text-xs text-navy">
                  Nhóm đã hoàn thành {e.progress.completed}/{e.progress.total} task
                </p>
              )}
              <div className="h-px bg-divider" />
              <p className="text-[11px] text-muted">
                09:00 mỗi ngày, mỗi BTT nhận một bản tin gộp mọi task còn lại (điện thoại + email): chụp ảnh từ 3 ngày trước sự kiện, recap từ hôm sau sự kiện. Bấm “Nhắc” ở từng task để nhắc cả nhóm ngay.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

type SetNotice = (n: { tone: 'success' | 'error'; text: string } | null) => void;

function TaskRow({ task: t, event, onChanged, setNotice }: { task: Task; event: EventDetail; onChanged: () => void; setNotice: SetNotice }) {
  const left = timeLeft(t.deadline);
  return (
    <div className="grid gap-3 border-b border-divider py-4 last:border-0 sm:grid-cols-[1fr_150px_190px] sm:items-center">
      <div>
        <p className="text-[15px] text-navy">{t.title}</p>
        <p className="text-[11px] text-muted">{t.dimensions ?? 'Không yêu cầu kích thước'}</p>
      </div>
      <div className="text-xs">
        <p className="text-primary">{t.status === 'COMPLETED' && t.completedAt ? `Đã nộp ${fmtDayTime(t.completedAt)}${t.completedBy ? ` · ${t.completedBy.fullName}` : ''}` : left.text}</p>
        <p className="mt-1 text-[11px] text-muted">Hạn {fmtDayTime(t.deadline)}</p>
      </div>
      <div className="flex flex-col gap-2">
        <TaskActions task={t} event={event} onChanged={onChanged} setNotice={setNotice} />
        <ProgressBar value={t.progress} />
      </div>
    </div>
  );
}

/** Ô đổi trạng thái (BTT) hoặc nút "Nhắc" (BCH) */
function TaskActions({ task: t, event, onChanged, setNotice }: { task: Task; event: EventDetail; onChanged: () => void; setNotice: SetNotice }) {
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: TaskStatus) {
    setBusy(true);
    try {
      await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status, progress: PROGRESS_FOR[status](t.progress) } });
      setNotice({ tone: 'success', text: `Đã cập nhật “${t.title}”: ${TASK_STATUS_LABEL[status]}.` });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    setBusy(true);
    try {
      const r = await api<{ sent: number }>(`/tasks/${t.id}/remind`, { method: 'POST', body: {} });
      setNotice({ tone: 'success', text: `Đã gửi nhắc “${t.title}” tới ${r.sent} người.` });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {event.permissions.canUpdateTasks ? (
        <Dropdown
          size="sm"
          pill
          className="w-[140px]"
          width={180}
          label={`Trạng thái ${t.title}`}
          value={t.status}
          disabled={busy}
          onChange={(v) => v !== t.status && changeStatus(v)}
          options={(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
        />
      ) : (
        <TaskStatusBadge task={t} />
      )}
      {event.permissions.canRemind && t.status !== 'COMPLETED' && (
        <Button size="sm" variant="outline" onClick={remind} loading={busy} icon={<BellRing className="size-3.5" />}>
          Nhắc
        </Button>
      )}
    </div>
  );
}

function ContentBox({ title, text }: { title: string; text: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-navy">{title}</p>
      <div className="min-h-[90px] whitespace-pre-line rounded-lg bg-soft p-3 text-xs text-navy">{text || '—'}</div>
      {text && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          icon={<Copy className="size-3.5" />}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Đã sao chép' : 'Sao chép nội dung'}
        </Button>
      )}
    </div>
  );
}
