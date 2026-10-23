'use client';
// Thẻ "Nhắc nhở thông minh" của BTT (Figma: cột phải màn "BTT tracking and smart reminders")
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlarmClock, Camera, CheckCircle2, Clock, Newspaper, ShieldCheck, X } from 'lucide-react';
import { Badge, Button, Empty } from './ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDayTime, fmtRange, timeLeft } from '@/lib/format';
import type { Reminders } from '@/lib/types';

/** "Đã hiểu" chỉ ẩn thẻ trong hôm nay trên trình duyệt này — KHÔNG hoàn thành task */
const todayKey = (k: string) => `cse_dismiss:${k}:${new Date().toDateString()}`;
function useDismissed(key: string) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(todayKey(key)) === '1');
    } catch {}
  }, [key]);
  return [
    hidden,
    () => {
      try {
        localStorage.setItem(todayKey(key), '1');
      } catch {}
      setHidden(true);
    },
  ] as const;
}

export function ReminderCards({ data, onChanged }: { data: Reminders | null; onChanged: () => void }) {
  if (!data) return null;
  const empty = !data.deadline.length && !data.photo.length && !data.recap.length;
  return (
    <div className="flex flex-col gap-4">
      {data.deadline.length > 0 && <DeadlineCard tasks={data.deadline} />}
      {data.photo.map((r) => (
        <PhotoCard key={r.task.id} r={r} onDone={onChanged} />
      ))}
      {data.recap.map((r) => (
        <RecapCard key={r.task.id} r={r} onDone={onChanged} />
      ))}
      {empty && (
        <div className="card">
          <Empty>Không có nhắc nhở nào. Mọi thứ đang đúng tiến độ!</Empty>
        </div>
      )}
      <p className="flex items-start gap-2 text-[11px] text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        Thẻ nhắc nhở cập nhật theo thời gian thực. Mỗi ngày lúc 09:00 bạn nhận một bản tin gộp mọi task còn lại qua điện thoại và email.
      </p>
    </div>
  );
}

function DeadlineCard({ tasks }: { tasks: Reminders['deadline'] }) {
  const [hidden, dismiss] = useDismissed(`deadline:${tasks.map((t) => t.id).join(',')}`);
  if (hidden) return null;
  const first = tasks[0];
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-ice">
          <AlarmClock className="size-4 text-primary" />
        </span>
        <div className="flex-1">
          <p className="text-[15px] text-navy">Cảnh báo hạn chót</p>
          <p className="text-[10px] uppercase text-primary">Tự động · trong 48 giờ tới</p>
        </div>
        <button onClick={dismiss} aria-label="Đóng">
          <X className="size-4 text-primary" />
        </button>
      </div>
      <p className="text-[13px] text-navy">{tasks.length} ấn phẩm cần bạn chú ý.</p>
      {tasks.map((t) => {
        const left = timeLeft(t.deadline);
        return (
          <div key={t.id} className="rounded-lg bg-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-navy">{t.title}</span>
              <Badge tone={left.overdue ? 'navy' : 'ice'}>{left.text}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {t.event?.name} · {fmtDayTime(t.deadline)}
            </p>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/events/${first.eventId}`}>
          <Button className="w-full">Mở task</Button>
        </Link>
        <Button variant="outline" onClick={dismiss}>
          Đã hiểu
        </Button>
      </div>
      <p className="text-[10px] text-muted">“Đã hiểu” chỉ ẩn thẻ này, không đánh dấu task hoàn thành.</p>
    </div>
  );
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

function PhotoCard({ r, onDone }: { r: Reminders['photo'][number]; onDone: () => void }) {
  const { complete, loading, error } = useComplete(r.task.id, onDone);
  const when = r.daysUntilEvent > 0 ? `Sự kiện diễn ra sau ${r.daysUntilEvent} ngày.` : r.daysUntilEvent === 0 ? 'Sự kiện diễn ra hôm nay.' : 'Sự kiện đã diễn ra.';
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-navy p-5 text-white">
      <div className="flex items-center justify-between">
        <Camera className="size-5 text-sky" />
        <Badge>Hằng ngày · Đang bật</Badge>
      </div>
      <p className="text-lg">Nhắc phân công chụp ảnh</p>
      <div className="text-xs text-white/90">
        <p>{r.event.name}</p>
        <p className="mt-1">
          {fmtDate(r.event.startsAt)} · {fmtRange(r.event.startsAt, r.event.endsAt)} · {r.event.location}
        </p>
      </div>
      <p className="text-[13px]">
        {when} Hãy xác nhận {r.event.photographerQuantity} người chụp ảnh cho toàn bộ sự kiện.
      </p>
      <div className="rounded-lg bg-white/10 p-3">
        <p className="text-[10px] uppercase text-sky">Trạng thái phân công</p>
        <p className="mt-1 text-[13px]">
          Cần {r.event.photographerQuantity} người chụp · Cả nhóm BTT phụ trách
        </p>
      </div>
      <Button onClick={complete} loading={loading} icon={<CheckCircle2 className="size-4" />} className="!border-sky/40">
        Đánh dấu hoàn thành
      </Button>
      {error && <p className="text-xs text-red-200">{error}</p>}
      <p className="text-[11px] text-white/80">Có trong bản tin hằng ngày từ 3 ngày trước sự kiện. Đánh dấu hoàn thành sau khi xác nhận người chụp để dừng nhắc.</p>
    </div>
  );
}

function RecapCard({ r, onDone }: { r: Reminders['recap'][number]; onDone: () => void }) {
  const { complete, loading, error } = useComplete(r.task.id, onDone);
  const left = timeLeft(r.task.deadline);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <Newspaper className="size-5 text-primary" />
        <Badge tone="navy">Hằng ngày · Còn nợ</Badge>
      </div>
      <p className="text-lg text-navy">Nhắc recap sau sự kiện</p>
      <div className="text-xs text-muted">
        <p className="text-navy">{r.event.name}</p>
        <p className="mt-1">Đã kết thúc {fmtDayTime(r.event.endsAt)}</p>
      </div>
      <p className="text-[13px] text-navy">Sự kiện đã kết thúc nhưng chưa có recap. Hãy đăng bài highlight và album ảnh.</p>
      <div className="flex items-center gap-2 rounded-lg bg-ice p-3 text-xs text-navy">
        <Clock className="size-4 text-primary" /> Hạn {fmtDayTime(r.task.deadline)} · {left.overdue ? 'Quá hạn' : left.text}
      </div>
      <Button onClick={complete} loading={loading}>
        Đã đăng recap / Hoàn thành
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[11px] text-muted">Nhắc mỗi ngày sau sự kiện cho tới khi xác nhận. Bấm hoàn thành sẽ dừng mọi nhắc recap.</p>
    </div>
  );
}
