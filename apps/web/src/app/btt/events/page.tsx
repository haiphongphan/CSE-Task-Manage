'use client';
// BTT · Sự kiện đang hoạt động (Figma: "BTT active event list")
import Link from 'next/link';
import { useState } from 'react';
import { ArrowDownWideNarrow, ArrowRight, Bell, CalendarDays, Clock, History, Info, MapPin, Search, Timer } from 'lucide-react';
import { Button, Chips, Empty, ErrorBox, Loading, PageHeader, ProgressBar, StatCard, cx } from '@/components/ui';
import { qs } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDayTime, fmtNow, fmtRange, TASK_STATUS_LABEL, timeLeft } from '@/lib/format';
import type { EventPhase, EventSummary, Reminders } from '@/lib/types';

interface Resp {
  items: EventSummary[];
  stats: { active: number; upcoming: number; postEvent: number; pendingDeliverables: number; photographerPending: number; overdueRecaps: number };
}

export default function BttEventsPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'' | EventPhase>('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(`/events${qs({ phase, search: q })}`);
  const { data: reminders } = useApi<Reminders>('/reminders');
  const s = data?.stats;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BTT / Ban Truyền thông"
        title="Sự kiện đang hoạt động"
        description="Các brief được giao cho đội. Ưu tiên rõ ràng, từ chuẩn bị tới recap."
        meta={
          <>
            <Clock className="size-4 text-primary" /> {user?.fullName} · Ban Truyền thông <span>/</span> {fmtNow()}
          </>
        }
        action={
          <Link href="/btt/reminders">
            <Button variant="outline" icon={<Bell className="size-4" />}>
              Nhắc nhở thông minh · {reminders?.total ?? 0}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sự kiện đang hoạt động" value={s?.active ?? '–'} sub={`${s?.upcoming ?? 0} sắp diễn ra · ${s?.postEvent ?? 0} sau sự kiện`} />
        <StatCard label="Ấn phẩm chờ làm" value={s?.pendingDeliverables ?? '–'} sub={`Thêm ${s?.photographerPending ?? 0} task chụp ảnh`} />
        <StatCard label="Recap quá hạn" value={s?.overdueRecaps ?? '–'} sub={s?.overdueRecaps ? 'Cần xử lý ngay' : 'Không có recap trễ hạn'} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4">
          <div className="relative w-full sm:w-[360px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
            <input className="input !bg-white pl-9" placeholder="Tìm sự kiện được giao" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Chips
            value={phase}
            onChange={setPhase}
            options={[
              { value: '', label: `Tất cả ${s?.active ?? ''}` },
              { value: 'UPCOMING', label: `Sắp diễn ra ${s?.upcoming ?? ''}` },
              { value: 'POST_EVENT', label: `Sau sự kiện ${s?.postEvent ?? ''}` },
            ]}
          />
        </div>
        <span className="inline-flex min-h-[38px] items-center gap-2 self-start rounded-lg border border-line bg-white px-4 text-[13px] text-primary">
          <ArrowDownWideNarrow className="size-4" /> Khẩn cấp trước
        </span>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold text-navy">Được giao cho đội media</h2>
          <span className="text-xs text-muted">{data?.items.length ?? 0} sự kiện · Khẩn cấp trước</span>
        </div>
        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : !data?.items.length ? (
          <div className="card">
            <Empty>Không có sự kiện nào đang cần bạn xử lý 🎉</Empty>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>

      <div className="card flex gap-3 bg-soft p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold text-navy">Hiển thị cho tới khi task cuối cùng hoàn thành.</p>
          <p className="text-xs text-muted">
            Danh sách gồm mọi sự kiện đội bạn được giao, không chỉ task của riêng bạn. Sự kiện đã kết thúc vẫn ở đây khi còn nợ recap; sự kiện xong hết sẽ được ẩn.
          </p>
        </div>
      </div>
    </div>
  );
}

function EventCard({ e }: { e: EventSummary }) {
  const recapOverdue = e.phase === 'POST_EVENT' && e.progress.overdue > 0;
  const next = e.progress.nextDeadline;
  const nextLeft = next ? timeLeft(next.deadline) : null;
  const high = !!nextLeft && nextLeft.hours < 48;

  const header = recapOverdue
    ? { icon: <History className="size-4" />, text: 'Recap quá hạn', cls: 'bg-navy text-white' }
    : high
      ? { icon: <Timer className="size-4" />, text: `Ưu tiên cao · Hạn ${nextLeft!.text}`, cls: 'bg-soft text-primary' }
      : { icon: <CalendarDays className="size-4" />, text: `Bình thường · ${e.phase === 'POST_EVENT' ? 'Sau sự kiện' : 'Sắp diễn ra'}`, cls: 'bg-soft text-primary' };

  return (
    <article className={cx('card flex flex-col overflow-hidden', recapOverdue && 'border-navy')}>
      <div className={cx('flex items-center gap-2 px-5 py-3 text-xs font-medium', header.cls)}>
        {header.icon} {header.text}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="text-[10px] uppercase text-primary">{e.phase === 'POST_EVENT' ? 'Sau sự kiện' : 'Sắp diễn ra'} · Giao bởi BCH</p>
          <h3 className="mt-1 text-xl font-bold text-navy">{e.name}</h3>
          <p className="mt-1 text-[11px] text-muted">Tạo bởi {e.createdBy?.fullName} · Ban Chấp hành</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase text-navy">Ngày sự kiện · ICT</p>
          <p className="flex items-center gap-2 text-[13px] text-navy">
            <CalendarDays className="size-4 text-primary" /> {fmtDate(e.startsAt)} · {fmtRange(e.startsAt, e.endsAt)}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted">
            <MapPin className="size-4 text-primary" /> {e.location}
          </p>
        </div>
        <div className="h-px bg-divider" />
        <div className="flex items-start gap-3">
          <span className="text-3xl font-bold leading-none text-navy">{e.progress.pendingDeliverables || (e.progress.recapPending ? 1 : 0)}</span>
          <div>
            <p className="text-[13px] font-medium text-navy">{e.progress.pendingDeliverables ? 'Ấn phẩm chờ làm' : 'Việc còn lại'}</p>
            <p className="text-[11px] text-muted">{e.progress.pendingDeliverables ? 'Ấn phẩm media, chưa tính chụp ảnh' : 'Recap còn lại sau sự kiện'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-navy">
            {e.progress.completed} / {e.progress.total} task hoàn thành
          </span>
          <ProgressBar value={e.progress.percent} />
        </div>
        {recapOverdue ? (
          <div className="rounded-lg bg-soft p-3">
            <p className="text-xs font-bold text-navy">{e.progress.overdue} task quá hạn</p>
            <p className="text-[11px] text-muted">Hãy hoàn thành recap càng sớm càng tốt</p>
          </div>
        ) : next ? (
          <div className="rounded-lg bg-soft p-3">
            <p className="text-xs font-medium text-primary">Hạn tiếp theo: {nextLeft!.text}</p>
            <p className="text-[11px] text-muted">
              {next.taskTitle} · {fmtDayTime(next.deadline)} ICT
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {e.openTasks.slice(0, 2).map((t) => (
            <div key={t.id}>
              <p className="text-xs font-medium text-navy">
                {t.title} · {TASK_STATUS_LABEL[t.status]}
              </p>
              <p className="text-[11px] text-muted">
                {t.dimensions ? `${t.dimensions} · ` : ''}Hạn {fmtDayTime(t.deadline)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-auto text-[11px] text-primary">
          {e.photographerNeeded
            ? e.progress.photographerPending
              ? `+ ${e.photographerQuantity} người chụp ảnh chưa xác nhận`
              : 'Đã xác nhận người chụp ảnh'
            : 'Không có task chụp ảnh · Chỉ ấn phẩm media'}
          {' · '}
          {e.members.map((m) => m.fullName).join(', ')}
        </p>
        <Link href={`/events/${e.id}`}>
          <Button className="w-full" icon={<ArrowRight className="size-4" />}>
            Xem sự kiện
          </Button>
        </Link>
      </div>
    </article>
  );
}
