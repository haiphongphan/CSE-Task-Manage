'use client';
// BCH · Sự kiện của tôi (Figma: "BCH event list")
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Eye, PenSquare, Plus, Search, X } from 'lucide-react';
import { Button, Chips, Empty, ErrorBox, Loading, PageHeader, ProgressBar, StatCard } from '@/components/ui';
import { EventStatusBadge } from '@/components/status';
import { qs } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { FLASH_KEY } from '@/lib/flash';
import { fmtDate, fmtDayTime, fmtNow, fmtRange } from '@/lib/format';
import type { EventStatus, EventSummary } from '@/lib/types';

interface Resp {
  items: EventSummary[];
  stats: { total: number; draft: number; published: number; completed: number };
}


function progressNote(e: EventSummary) {
  if (e.status === 'DRAFT') return 'Đã lưu nháp · Chưa phân công BTT';
  if (e.status === 'COMPLETED') return 'Tất cả ấn phẩm và recap đã hoàn thành';
  const parts = [];
  if (e.progress.pendingDeliverables) parts.push(`${e.progress.pendingDeliverables} ấn phẩm còn lại`);
  if (e.progress.photographerPending) parts.push('chụp ảnh chưa xác nhận');
  if (e.phase === 'POST_EVENT' && e.progress.recapPending) parts.push('còn nợ recap');
  return parts.join(' · ') || 'Đang tiến hành';
}

export default function BchEventsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'' | EventStatus>('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(`/events${qs({ status, search: q })}`);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const f = sessionStorage.getItem(FLASH_KEY);
    if (f) {
      setFlash(f);
      sessionStorage.removeItem(FLASH_KEY);
    }
  }, []);

  const s = data?.stats;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BCH / Ban Chấp hành"
        title="Sự kiện của tôi"
        description="Quản lý brief, phân công và tiến độ sự kiện."
        meta={
          <>
            <Clock className="size-4 text-primary" /> {user?.fullName} · Ban Chấp hành <span>/</span> {fmtNow()}
          </>
        }
        action={
          <Link href="/bch/events/new">
            <Button icon={<Plus className="size-4" />}>Tạo sự kiện</Button>
          </Link>
        }
      />

      {flash && (
        <div className="card flex items-start gap-3 bg-soft p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-navy">{flash.split('|')[0]}</p>
            <p className="text-xs text-muted">{flash.split('|')[1]}</p>
          </div>
          <button onClick={() => setFlash(null)} aria-label="Đóng">
            <X className="size-4 text-primary" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sự kiện của tôi" value={s?.total ?? '–'} />
        <StatCard label="Nháp" value={s?.draft ?? '–'} />
        <StatCard label="Đang thực hiện" value={s?.published ?? '–'} />
        <StatCard label="Hoàn thành" value={s?.completed ?? '–'} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
          <input className="input !bg-white pl-9" placeholder="Tìm sự kiện của bạn" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold text-navy">Do bạn tạo</h2>
          <span className="text-xs text-muted">{data?.items.length ?? 0} sự kiện · Mới cập nhật trước</span>
        </div>

        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : !data?.items.length ? (
          <div className="card">
            <Empty>Chưa có sự kiện nào. Bấm “Tạo sự kiện” để bắt đầu.</Empty>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[1.6fr_0.8fr_0.7fr_1fr_auto] gap-4 bg-soft px-5 py-3 text-[11px] uppercase text-navy lg:grid">
              <span>Sự kiện / Địa điểm</span>
              <span>Ngày · ICT</span>
              <span>Trạng thái</span>
              <span>Tiến độ task</span>
              <span className="w-[250px]">Thao tác nhanh</span>
            </div>
            {data.items.map((e) => (
              <div key={e.id} className="grid gap-4 border-b border-divider px-5 py-5 last:border-0 lg:grid-cols-[1.6fr_0.8fr_0.7fr_1fr_auto] lg:items-center">
                <div>
                  <p className="text-[15px] font-bold text-navy">{e.name}</p>
                  <p className="mt-1 text-xs text-muted">{e.location}</p>
                  <p className="mt-1 text-[11px] text-primary">Tạo bởi bạn · {e.createdBy?.fullName}</p>
                </div>
                <div className="text-[13px] text-navy">
                  {fmtDate(e.startsAt)}
                  <span className="block text-xs text-muted">{fmtRange(e.startsAt, e.endsAt)}</span>
                </div>
                <div>
                  <EventStatusBadge status={e.status} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {e.status !== 'DRAFT' && (
                    <>
                      <span className="text-xs text-navy">
                        {e.progress.completed} / {e.progress.total} task hoàn thành
                      </span>
                      <ProgressBar value={e.progress.percent} />
                    </>
                  )}
                  <span className="text-[11px] text-muted">{progressNote(e)}</span>
                  {e.progress.nextDeadline && e.status !== 'DRAFT' && (
                    <span className="text-[11px] text-primary">Hạn gần nhất: {fmtDayTime(e.progress.nextDeadline.deadline)}</span>
                  )}
                </div>
                <div className="flex gap-2 lg:w-[250px]">
                  {e.editable ? (
                    <Link href={`/bch/events/${e.id}/edit`} className="flex-1">
                      <Button variant="outline" className="w-full" icon={<PenSquare className="size-4" />}>
                        Sửa
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" className="flex-1" disabled title="Sự kiện đã diễn ra, không thể sửa">
                      Đã diễn ra
                    </Button>
                  )}
                  <Link href={`/events/${e.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" icon={<Eye className="size-4" />}>
                      Chi tiết
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">ⓘ “Sửa” mở lại brief sự kiện. Bản nháp chỉ mình bạn thấy cho tới khi gửi và phân công cho BTT.</p>
    </div>
  );
}
