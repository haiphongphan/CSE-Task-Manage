'use client';
// Form tạo / sửa sự kiện của BCH (Figma: "BCH event and task creation")
// Flow phân công: BCH chọn các BTT phụ trách ngay trong mục 01. Mọi task
// (ấn phẩm, chụp ảnh, recap) giao cho CẢ NHÓM đó — không giao riêng từng người.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Camera, CheckCircle2, CheckSquare, Info, MapPin, Minus, Plus, Sparkles, Square, Trash2, Users, X } from 'lucide-react';
import { Alert, Badge, Button, Field, Toggle, cx } from './ui';
import { DatePicker, MemberPicker, TimePicker, formatYmd } from './pickers';
import { api, type ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { FLASH_KEY } from '@/lib/flash';
import { fromInputs, TASK_TYPE_LABEL, toDateInput, toTimeInput } from '@/lib/format';
import type { EventDetail, MiniUser } from '@/lib/types';

const DELIVERABLES = ['BANNER', 'BACKDROP', 'BANDROLL', 'STANDEE', 'INVITATION_LETTER', 'OTHER'] as const;
type DeliverableType = (typeof DELIVERABLES)[number];
const DIM_REQUIRED: DeliverableType[] = ['BACKDROP', 'BANDROLL', 'STANDEE'];

interface DeliverableState {
  id?: number;
  title: string;
  dimensions: string;
  date: string;
  time: string;
}

function initialDeliverables(event?: EventDetail) {
  const map: Partial<Record<DeliverableType, DeliverableState>> = {};
  event?.tasks
    .filter((t) => (DELIVERABLES as readonly string[]).includes(t.type))
    .forEach((t) => {
      map[t.type as DeliverableType] = {
        id: t.id,
        title: t.type === 'OTHER' ? t.title : '',
        dimensions: t.dimensions ?? '',
        date: toDateInput(t.deadline),
        time: toTimeInput(t.deadline),
      };
    });
  return map;
}

/** Ngày trước ngày yyyy-mm-dd */
const dayBefore = (date: string) => {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function EventForm({ event }: { event?: EventDetail }) {
  const router = useRouter();
  const isEdit = !!event;
  const isDraft = !event || event.status === 'DRAFT';
  const { data: bttData } = useApi<{ items: (MiniUser & { username: string })[] }>('/users/options?role=BTT');
  const btts = bttData?.items ?? [];

  const [info, setInfo] = useState({
    name: event?.name ?? '',
    location: event?.location ?? '',
    date: event ? toDateInput(event.startsAt) : '',
    startTime: event ? toTimeInput(event.startsAt) : '09:00',
    endTime: event ? toTimeInput(event.endsAt) : '16:00',
    notes: event?.notes ?? '',
    onlineContent: event?.onlineContent ?? '',
    offlineContent: event?.offlineContent ?? '',
  });
  const [deliverables, setDeliverables] = useState(() => initialDeliverables(event));
  const [photo, setPhoto] = useState({ needed: event?.photographerNeeded ?? true, quantity: event?.photographerQuantity || 1 });
  const [memberIds, setMemberIds] = useState<number[]>(event?.members.map((m) => m.id) ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const selectedTypes = DELIVERABLES.filter((t) => deliverables[t]);
  const members = btts.filter((u) => memberIds.includes(u.id));
  const taskCount = selectedTypes.length + (photo.needed ? 1 : 0) + 1; // +1 recap
  const today = toDateInput(new Date().toISOString());

  const setI = (k: keyof typeof info) => (v: string) => setInfo({ ...info, [k]: v });

  function toggleDeliverable(type: DeliverableType) {
    setDeliverables((cur) => {
      const next = { ...cur };
      if (next[type]) delete next[type];
      else next[type] = { title: '', dimensions: '', date: dayBefore(info.date), time: '17:00' };
      return next;
    });
  }
  const updateDeliverable = (type: DeliverableType, patch: Partial<DeliverableState>) =>
    setDeliverables((cur) => ({ ...cur, [type]: { ...cur[type]!, ...patch } }));

  /** Kiểm tra phía trình duyệt cho phản hồi nhanh — API vẫn kiểm tra lại */
  function validate(publish: boolean) {
    const errs: string[] = [];
    if (info.name.trim().length < 3) errs.push('Tên sự kiện tối thiểu 3 ký tự');
    if (!info.location.trim()) errs.push('Vui lòng nhập địa điểm');
    if (!info.date) errs.push('Vui lòng chọn ngày sự kiện');
    if (info.endTime <= info.startTime) errs.push('Giờ kết thúc phải sau giờ bắt đầu');
    if (publish && memberIds.length === 0) errs.push('Chọn ít nhất 1 thành viên BTT phụ trách (mục 01)');
    for (const t of selectedTypes) {
      const d = deliverables[t]!;
      if (DIM_REQUIRED.includes(t) && !d.dimensions.trim()) errs.push(`${TASK_TYPE_LABEL[t]}: cần nhập kích thước`);
      if (t === 'OTHER' && !d.title.trim()) errs.push('Ấn phẩm “Khác”: cần nhập loại ấn phẩm');
      if (!d.date || !d.time) errs.push(`${TASK_TYPE_LABEL[t]}: cần chọn hạn chót`);
    }
    if (publish && selectedTypes.length === 0 && !photo.needed) errs.push('Chọn ít nhất 1 ấn phẩm hoặc bật chụp ảnh');
    return errs;
  }

  async function submit(publish: boolean) {
    const errs = validate(publish);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });

    const body = {
      name: info.name,
      location: info.location,
      startsAt: fromInputs(info.date, info.startTime),
      endsAt: fromInputs(info.date, info.endTime),
      notes: info.notes || null,
      onlineContent: info.onlineContent || null,
      offlineContent: info.offlineContent || null,
      photographerNeeded: photo.needed,
      photographerQuantity: photo.needed ? photo.quantity : 0,
      memberIds,
      deliverables: selectedTypes.map((type) => {
        const d = deliverables[type]!;
        return {
          id: d.id,
          type,
          title: type === 'OTHER' ? d.title : undefined,
          dimensions: d.dimensions || null,
          deadline: fromInputs(d.date, d.time),
        };
      }),
      publish,
    };

    setSaving(publish ? 'publish' : 'draft');
    try {
      const res = await api<{ event: EventDetail }>(isEdit ? `/events/${event.id}` : '/events', {
        method: isEdit ? 'PUT' : 'POST',
        body,
      });
      const title = publish ? (isEdit && !isDraft ? 'Đã lưu thay đổi' : 'Đã tạo sự kiện và phân công cho BTT') : 'Đã lưu bản nháp';
      const detail = publish
        ? `${res.event.name} đã có trong danh sách. ${members.length} thành viên BTT đã được thông báo.`
        : `${res.event.name} chỉ mình bạn thấy cho tới khi gửi.`;
      sessionStorage.setItem(FLASH_KEY, `${title}|${detail}`);
      router.push('/bch/events');
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.details?.map((d) => d.message) ?? [e2.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(null);
    }
  }

  async function removeDraft() {
    if (!event || !confirm('Xoá bản nháp này?')) return;
    await api(`/events/${event.id}`, { method: 'DELETE' });
    router.push('/bch/events');
  }

  const summaryActions = (
    <>
      <Button onClick={() => submit(true)} loading={saving === 'publish'} disabled={!!saving} icon={<ArrowRight className="size-4" />}>
        {isDraft ? 'Gửi & phân công task' : 'Lưu thay đổi'}
      </Button>
      {isDraft && (
        <Button variant="outline" onClick={() => submit(false)} loading={saving === 'draft'} disabled={!!saving}>
          Lưu nháp
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">BCH / Ban Chấp hành</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-navy sm:text-[32px]">{isEdit ? 'Sửa brief sự kiện' : 'Tạo brief sự kiện'}</h1>
            <p className="mt-1.5 text-sm text-muted">Biến kế hoạch sự kiện thành các task media rõ ràng, dễ theo dõi.</p>
          </div>
          <Link href="/bch/events">
            <Button variant="outline" icon={<ArrowLeft className="size-4" />}>
              Về sự kiện của tôi
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Badge tone="navy">{isDraft ? 'Nháp' : 'Đã gửi'}</Badge> Mọi giờ theo ICT · * Bắt buộc
        </div>
      </div>

      {errors.length > 0 && (
        <Alert tone="error">
          <p className="font-medium">Vui lòng kiểm tra lại:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* 01 — thông tin chung + BTT phụ trách */}
          <section className="card flex flex-col gap-4 p-5">
            <SectionTitle no="01" title="Thông tin chung" desc="Những gì đội media cần biết." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên sự kiện *">
                <input className="input" value={info.name} onChange={(e) => setI('name')(e.target.value)} placeholder="Seminar xxx" />
              </Field>
              <Field label="Địa điểm *">
                <div className="relative">
                  <input className="input pr-10" value={info.location} onChange={(e) => setI('location')(e.target.value)} placeholder="Hội trường x, cs1" />
                  <MapPin className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                </div>
              </Field>
              <Field custom label="Ngày diễn ra *">
                <DatePicker value={info.date} onChange={setI('date')} min={isEdit ? undefined : today} />
              </Field>
              <Field custom label="Thời gian *">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <TimePicker value={info.startTime} onChange={setI('startTime')} />
                  <span className="text-muted">–</span>
                  <TimePicker value={info.endTime} onChange={setI('endTime')} />
                </div>
              </Field>
            </div>
            <Field
              custom
              label="Ban Truyền thông phụ trách *"
              hint="Các thành viên được chọn cùng phụ trách mọi task của sự kiện và nhận bản tin nhắc việc lúc 09:00 mỗi ngày."
            >
              <MemberPicker people={btts} value={memberIds} onChange={setMemberIds} placeholder="Chọn thành viên BTT" />
            </Field>
            <Field label="Thông tin chi tiết (Để ghi recap)">
              <textarea
                className="input min-h-[96px]"
                value={info.notes}
                onChange={(e) => setI('notes')(e.target.value)}
                placeholder="Mô tả sự kiện, khoảnh khắc cần ghi lại, nội dung recap..."
              />
            </Field>
          </section>

          {/* 02 */}
          <section className="card flex flex-col gap-4 p-5">
            <SectionTitle no="02" title="Chọn ấn phẩm media" desc="Chọn tất cả ấn phẩm cần làm. Mỗi ấn phẩm là một task có hạn chót riêng." />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DELIVERABLES.map((t) => {
                const on = !!deliverables[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleDeliverable(t)}
                    className={cx(
                      'flex min-h-[42px] items-center gap-2 rounded-lg border px-3 text-left text-xs text-navy transition',
                      on ? 'border-primary bg-ice' : 'border-line bg-white hover:bg-soft',
                    )}
                  >
                    {on ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4 text-line" />}
                    {TASK_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <p className="flex items-start gap-2 text-[11px] text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Backdrop, Bandroll và Standee bắt buộc nhập kích thước. “Khác” cần nhập loại ấn phẩm. Mọi ấn phẩm cần hạn chót.
            </p>

            {selectedTypes.map((t) => {
              const d = deliverables[t]!;
              const required = DIM_REQUIRED.includes(t);
              return (
                <div key={t} className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-navy">
                      <CheckCircle2 className="size-4 text-primary" /> {TASK_TYPE_LABEL[t]}
                    </span>
                    <button type="button" onClick={() => toggleDeliverable(t)} aria-label={`Bỏ ${TASK_TYPE_LABEL[t]}`} className="rounded p-1 hover:bg-white">
                      <X className="size-4 text-primary" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      {t === 'OTHER' && (
                        <Field label="Loại ấn phẩm *">
                          <input className="input" value={d.title} onChange={(e) => updateDeliverable(t, { title: e.target.value })} placeholder="Instagram story" />
                        </Field>
                      )}
                      <Field label={`Kích thước ${required ? '*' : '(tuỳ chọn)'}`} hint={required ? 'Bắt buộc cho bản in.' : undefined}>
                        <input className="input" value={d.dimensions} onChange={(e) => updateDeliverable(t, { dimensions: e.target.value })} placeholder="1920 × 1080 px" />
                      </Field>
                    </div>
                    <Field custom label="Hạn chót *" hint="ICT (UTC+7)">
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <DatePicker value={d.date} onChange={(v) => updateDeliverable(t, { date: v })} />
                        <TimePicker value={d.time} onChange={(v) => updateDeliverable(t, { time: v })} />
                      </div>
                    </Field>
                  </div>
                </div>
              );
            })}
          </section>

          {/* 03 */}
          <section className="card flex flex-col gap-4 p-5">
            <SectionTitle no="03" title="Nội dung ấn phẩm" desc="Giữ thông điệp online và nội dung in ấn thống nhất." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nội dung ấn phẩm online">
                <textarea className="input min-h-[110px]" value={info.onlineContent} onChange={(e) => setI('onlineContent')(e.target.value)} />
              </Field>
              <Field label="Nội dung ấn phẩm in ấn">
                <textarea className="input min-h-[110px]" value={info.offlineContent} onChange={(e) => setI('offlineContent')(e.target.value)} />
              </Field>
            </div>
          </section>

          {/* 04 */}
          <section className="card flex flex-col gap-4 p-5">
            <SectionTitle no="04" title="Chụp ảnh sự kiện" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-navy">Phân công người chụp ảnh cho ngày sự kiện</p>
                <p className="text-[11px] text-muted">Bật sẵn. Tắt nếu sự kiện không cần chụp ảnh.</p>
              </div>
              <Toggle checked={photo.needed} onChange={(v) => setPhoto({ ...photo, needed: v })} label="Cần chụp ảnh" />
            </div>
            {photo.needed && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-navy">Số người chụp *</p>
                  <p className="text-[11px] text-muted">{info.date ? `${formatYmd(info.date)} · ${info.startTime}–${info.endTime}` : 'Chọn ngày ở mục 01'}</p>
                </div>
                <div className="flex items-center rounded-lg border border-line bg-white">
                  <button type="button" className="p-2.5 text-primary" onClick={() => setPhoto({ ...photo, quantity: Math.max(1, photo.quantity - 1) })} aria-label="Giảm">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-sm">{photo.quantity}</span>
                  <button type="button" className="p-2.5 text-primary" onClick={() => setPhoto({ ...photo, quantity: Math.min(20, photo.quantity + 1) })} aria-label="Tăng">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted">
              Từ 3 ngày trước sự kiện, task chụp ảnh được đưa vào bản tin nhắc việc hằng ngày của BTT cho tới khi đánh dấu hoàn thành. Recap được nhắc ngay sau khi sự kiện kết thúc (hạn 7 ngày).
            </p>
          </section>

          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] text-navy">Sẵn sàng gửi cho đội media?</p>
              <p className="text-[11px] text-muted">
                {selectedTypes.length} ấn phẩm · {photo.needed ? `${photo.quantity} người chụp` : 'không chụp ảnh'} · {taskCount} task cho {memberIds.length} BTT
              </p>
            </div>
            <div className="flex gap-2">
              {isEdit && isDraft && (
                <Button variant="danger" onClick={removeDraft} icon={<Trash2 className="size-4" />}>
                  Xoá nháp
                </Button>
              )}
              {summaryActions}
            </div>
          </div>
        </div>

        {/* Tóm tắt bên phải */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="text-[15px] text-navy">Tóm tắt brief</h3>
            <Badge className="self-start">{memberIds.length ? `${isDraft ? 'Nháp' : 'Đã gửi'} · ${memberIds.length} BTT` : 'Nháp · Chưa phân công'}</Badge>
            <p className="text-[15px] text-navy">{info.name || 'Sự kiện chưa đặt tên'}</p>
            <p className="flex items-center gap-2 text-[11px] text-navy">
              <CalendarDays className="size-3.5 text-primary" />
              {info.date ? `${formatYmd(info.date)} · ${info.startTime}–${info.endTime}` : 'Chưa chọn ngày'}
            </p>
            <p className="flex items-center gap-2 text-[11px] text-navy">
              <MapPin className="size-3.5 text-primary" /> {info.location || 'Chưa có địa điểm'}
            </p>
            <div className="h-px bg-divider" />
            <Row label="Ấn phẩm media" value={selectedTypes.length} />
            <Row label="Người chụp ảnh" value={photo.needed ? photo.quantity : 0} />
            <Row label="BTT phụ trách" value={memberIds.length} />
            {members.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {members.map((m) => (
                  <Badge key={m.id}>
                    <Users className="mr-1 size-3" />
                    {m.fullName}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[11px] text-primary">{taskCount} task sẽ giao cho nhóm BTT</p>
            {summaryActions}
            <p className="text-[11px] text-muted">“Gửi & phân công” thông báo cho BTT và quay về danh sách. “Lưu nháp” giữ brief ở dạng nháp.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-navy p-5 text-white">
            <Sparkles className="size-5 text-sky" />
            <p className="text-[15px]">Brief rõ ràng. Sự kiện suôn sẻ.</p>
            <p className="text-xs text-white/80">Nhập kích thước in chính xác và hạn chót thực tế. Mỗi ấn phẩm đã chọn trở thành một task theo dõi được.</p>
            <p className="flex items-center gap-1.5 text-[11px] text-sky">
              <Camera className="size-3.5" /> BTT nhận bản tin gộp mọi task còn lại lúc 09:00 mỗi ngày.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ no, title, desc }: { no: string; title: string; desc?: string }) {
  return (
    <div>
      <h2 className="text-base text-navy">
        {no} · {title}
      </h2>
      {desc && <p className="mt-1 text-[11px] text-muted">{desc}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[11px] text-muted">
      <span>{label}</span>
      <span className="text-sm text-navy">{value}</span>
    </div>
  );
}
