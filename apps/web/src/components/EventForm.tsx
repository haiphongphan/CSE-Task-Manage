'use client';
// Form tạo / sửa sự kiện của BCH (Figma: "BCH event and task creation")
// Flow phân công: BCH chọn các BTT phụ trách ngay trong mục 01. Mọi task
// (ấn phẩm, chụp ảnh, recap) giao cho CẢ NHÓM đó — không giao riêng từng người.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Camera, CheckCircle2, CheckSquare, FileText, Info, MapPin, Minus, Plus, Sparkles, Square, Trash2, Upload, Users, X } from 'lucide-react';
import { Alert, Badge, Button, Field, Toggle, cx } from './ui';
import { DatePicker, MemberPicker, TimePicker, formatYmd } from './pickers';
import { api, type ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB, MAX_ATTACHMENTS, checkAttachment, fmtBytes, uploadAttachment } from '@/lib/attachments';
import { FLASH_KEY } from '@/lib/flash';
import { fromInputs, TASK_TYPE_LABEL, toDateInput, toTimeInput } from '@/lib/format';
import type { Attachment, EventDetail, MiniUser } from '@/lib/types';

const DELIVERABLES = ['BANNER', 'BACKDROP', 'BANDROLL', 'STANDEE', 'INVITATION_LETTER', 'OTHER'] as const;
type DeliverableType = (typeof DELIVERABLES)[number];
const DIM_REQUIRED: DeliverableType[] = ['BACKDROP', 'BANDROLL', 'STANDEE'];

/** Một ấn phẩm trong form. "Khác" có thể thêm nhiều cái, mỗi cái một loại riêng */
interface DeliverableState {
  key: string; // khoá React (ấn phẩm mới chưa có id)
  id?: number;
  type: DeliverableType;
  title: string;
  dimensions: string;
  date: string;
  time: string;
}

/** Một ngày diễn ra: ngày cụ thể + giờ từ–đến, kèm lịch chụp của ngày đó */
interface DayState {
  key: string;
  date: string;
  start: string;
  end: string;
  photo: { on: boolean; start: string; end: string; quantity: number };
}

const MAX_DAYS = 14;
let seq = 0;
const newKey = () => `k${++seq}`;

function initialDeliverables(event?: EventDetail): DeliverableState[] {
  return (event?.tasks ?? [])
    .filter((t) => (DELIVERABLES as readonly string[]).includes(t.type))
    .sort((a, b) => DELIVERABLES.indexOf(a.type as DeliverableType) - DELIVERABLES.indexOf(b.type as DeliverableType) || a.id - b.id)
    .map((t) => ({
      key: newKey(),
      id: t.id,
      type: t.type as DeliverableType,
      title: t.type === 'OTHER' ? t.title : '',
      dimensions: t.dimensions ?? '',
      date: toDateInput(t.deadline),
      time: toTimeInput(t.deadline),
    }));
}

function newDay(date = '', start = '09:00', end = '16:00', photoOn = true): DayState {
  return { key: newKey(), date, start, end, photo: { on: photoOn, start, end, quantity: 1 } };
}

function initialDays(event?: EventDetail): DayState[] {
  if (!event) return [newDay()];
  const sessions = event.sessions?.length ? event.sessions : [{ startsAt: event.startsAt, endsAt: event.endsAt }];
  return sessions.map((s) => {
    const date = toDateInput(s.startsAt);
    const slot = event.photoSlots?.find((p) => toDateInput(p.startsAt) === date);
    const day = newDay(date, toTimeInput(s.startsAt), toTimeInput(s.endsAt), !!slot);
    if (slot) day.photo = { on: true, start: toTimeInput(slot.startsAt), end: toTimeInput(slot.endsAt), quantity: slot.quantity };
    return day;
  });
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
  const { user } = useAuth();
  // Admin dùng chung form này để sửa sự kiện của BCH; lưu xong quay về trang Quản lý sự kiện
  const isAdmin = user?.role === 'ADMIN';
  const listHref = isAdmin ? '/admin/events' : '/bch/events';
  const isEdit = !!event;
  const isDraft = !event || event.status === 'DRAFT';
  const { data: bttData } = useApi<{ items: (MiniUser & { username: string })[] }>('/users/options?role=BTT');
  const btts = bttData?.items ?? [];

  const [info, setInfo] = useState({
    name: event?.name ?? '',
    location: event?.location ?? '',
    notes: event?.notes ?? '',
    onlineContent: event?.onlineContent ?? '',
    offlineContent: event?.offlineContent ?? '',
  });
  const [deliverables, setDeliverables] = useState(() => initialDeliverables(event));
  const [days, setDays] = useState<DayState[]>(() => initialDays(event));
  const [photoNeeded, setPhotoNeeded] = useState(event?.photographerNeeded ?? true);
  const [memberIds, setMemberIds] = useState<number[]>(event?.members.map((m) => m.id) ?? []);
  // File mẫu/tham chiếu (mục 03): file mới chỉ tải lên SAU khi lưu sự kiện (lúc tạo mới chưa có id)
  const [savedFiles, setSavedFiles] = useState<Attachment[]>(event?.attachments ?? []);
  const [removedFileIds, setRemovedFileIds] = useState<number[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const members = btts.filter((u) => memberIds.includes(u.id));
  const photoDays = photoNeeded ? days.filter((d) => d.photo.on) : [];
  const photoTotal = photoDays.reduce((s, d) => s + d.photo.quantity, 0);
  const taskCount = deliverables.length + (photoDays.length ? 1 : 0) + 1; // +1 recap
  // Ngày đã chọn, sắp theo thời gian (cho tóm tắt + hạn chót mặc định)
  const sortedDates = days.map((d) => d.date).filter(Boolean).sort();
  const firstDate = sortedDates[0] ?? '';
  const today = toDateInput(new Date().toISOString());
  const fileCount = savedFiles.length + newFiles.length;

  const setI = (k: keyof typeof info) => (v: string) => setInfo({ ...info, [k]: v });

  const blankDeliverable = (type: DeliverableType): DeliverableState => ({
    key: newKey(),
    type,
    title: '',
    dimensions: '',
    date: dayBefore(firstDate),
    time: '17:00',
  });
  /** Bấm ô loại ấn phẩm: loại thường thì bật/tắt; "Khác" thì thêm một ấn phẩm khác mới */
  function toggleDeliverable(type: DeliverableType) {
    setDeliverables((cur) => {
      if (type === 'OTHER') return [...cur, blankDeliverable('OTHER')];
      if (cur.some((d) => d.type === type)) return cur.filter((d) => d.type !== type);
      // giữ thứ tự theo danh sách loại
      return [...cur, blankDeliverable(type)].sort((a, b) => DELIVERABLES.indexOf(a.type) - DELIVERABLES.indexOf(b.type));
    });
  }
  const removeDeliverable = (key: string) => setDeliverables((cur) => cur.filter((d) => d.key !== key));
  const updateDeliverable = (key: string, patch: Partial<DeliverableState>) =>
    setDeliverables((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  // ---- Ngày diễn ra ----
  const updateDay = (key: string, patch: Partial<Omit<DayState, 'photo'>>) =>
    setDays((cur) =>
      cur.map((d) => {
        if (d.key !== key) return d;
        const next = { ...d, ...patch };
        // Giờ chụp đang trùng giờ sự kiện thì đổi theo
        if (patch.start !== undefined && d.photo.start === d.start) next.photo = { ...next.photo, start: patch.start };
        if (patch.end !== undefined && d.photo.end === d.end) next.photo = { ...next.photo, end: patch.end };
        return next;
      }),
    );
  const updatePhoto = (key: string, patch: Partial<DayState['photo']>) =>
    setDays((cur) => cur.map((d) => (d.key === key ? { ...d, photo: { ...d.photo, ...patch } } : d)));
  /** Đổi số ngày: thêm ngày mới (giờ giống ngày cuối) hoặc bỏ bớt các ngày cuối */
  function setDayCount(n: number) {
    const count = Math.min(MAX_DAYS, Math.max(1, n));
    setDays((cur) => {
      if (count <= cur.length) return cur.slice(0, count);
      const last = cur[cur.length - 1];
      const extra = Array.from({ length: count - cur.length }, () => newDay('', last.start, last.end, last.photo.on));
      return [...cur, ...extra];
    });
  }
  const removeDay = (key: string) => setDays((cur) => (cur.length > 1 ? cur.filter((d) => d.key !== key) : cur));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const errs: string[] = [];
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      const err = checkAttachment(f);
      if (err) errs.push(err);
      else if (fileCount + accepted.length >= MAX_ATTACHMENTS) errs.push(`Tối đa ${MAX_ATTACHMENTS} file — bỏ qua “${f.name}”`);
      else accepted.push(f);
    }
    setFileErrors(errs);
    setNewFiles((cur) => [...cur, ...accepted]);
  }

  function removeSavedFile(id: number) {
    setSavedFiles((cur) => cur.filter((f) => f.id !== id));
    setRemovedFileIds((cur) => [...cur, id]);
  }

  /** Đồng bộ file sau khi sự kiện đã lưu. Trả về tên các file lỗi (sự kiện vẫn được lưu) */
  async function syncFiles(eventId: number) {
    const failed: string[] = [];
    for (const id of removedFileIds) {
      await api(`/events/${eventId}/attachments/${id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    for (const f of newFiles) {
      await uploadAttachment(eventId, f).catch(() => failed.push(f.name));
    }
    return failed;
  }

  /** Kiểm tra phía trình duyệt cho phản hồi nhanh — API vẫn kiểm tra lại */
  function validate(publish: boolean) {
    const errs: string[] = [];
    if (info.name.trim().length < 3) errs.push('Tên sự kiện tối thiểu 3 ký tự');
    if (!info.location.trim()) errs.push('Vui lòng nhập địa điểm');
    days.forEach((d, i) => {
      if (!d.date) errs.push(`Ngày ${i + 1}: vui lòng chọn ngày`);
      if (d.end <= d.start) errs.push(`Ngày ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`);
      if (photoNeeded && d.photo.on && d.photo.end <= d.photo.start) errs.push(`Chụp ảnh ngày ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`);
    });
    if (new Set(sortedDates).size !== sortedDates.length) errs.push('Có ngày diễn ra bị chọn trùng — mỗi ngày chỉ chọn một lần');
    if (publish && memberIds.length === 0) errs.push('Chọn ít nhất 1 thành viên BTT phụ trách (mục 01)');
    let otherNo = 0;
    for (const d of deliverables) {
      const label = d.type === 'OTHER' ? `Ấn phẩm khác #${++otherNo}` : TASK_TYPE_LABEL[d.type];
      if (DIM_REQUIRED.includes(d.type) && !d.dimensions.trim()) errs.push(`${label}: cần nhập kích thước`);
      if (d.type === 'OTHER' && !d.title.trim()) errs.push(`${label}: cần nhập loại ấn phẩm`);
      if (!d.date || !d.time) errs.push(`${label}: cần chọn hạn chót`);
    }
    if (photoNeeded && photoDays.length === 0) errs.push('Chụp ảnh: chọn ít nhất 1 ngày cần chụp, hoặc tắt chụp ảnh');
    if (publish && deliverables.length === 0 && photoDays.length === 0) errs.push('Chọn ít nhất 1 ấn phẩm hoặc bật chụp ảnh');
    return errs;
  }

  async function submit(publish: boolean) {
    const errs = validate(publish);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });

    const body = {
      name: info.name,
      location: info.location,
      sessions: days.map((d) => ({ startsAt: fromInputs(d.date, d.start), endsAt: fromInputs(d.date, d.end) })),
      notes: info.notes || null,
      onlineContent: info.onlineContent || null,
      offlineContent: info.offlineContent || null,
      photoSlots: photoDays.map((d) => ({
        startsAt: fromInputs(d.date, d.photo.start),
        endsAt: fromInputs(d.date, d.photo.end),
        quantity: d.photo.quantity,
      })),
      memberIds,
      deliverables: deliverables.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.type === 'OTHER' ? d.title : undefined,
        dimensions: d.dimensions || null,
        deadline: fromInputs(d.date, d.time),
      })),
      publish,
    };

    setSaving(publish ? 'publish' : 'draft');
    try {
      const res = await api<{ event: EventDetail }>(isEdit ? `/events/${event.id}` : '/events', {
        method: isEdit ? 'PUT' : 'POST',
        body,
      });
      const failedFiles = await syncFiles(res.event.id);
      const title = publish ? (isEdit && !isDraft ? 'Đã lưu thay đổi' : 'Đã tạo sự kiện và phân công cho BTT') : 'Đã lưu bản nháp';
      const detail =
        (publish
          ? `${res.event.name} đã có trong danh sách. ${members.length} thành viên BTT đã được thông báo.`
          : `${res.event.name} chỉ mình bạn thấy cho tới khi gửi.`) +
        (failedFiles.length ? ` Chưa tải lên được: ${failedFiles.join(', ')} — mở “Sửa” để thử lại.` : '');
      sessionStorage.setItem(FLASH_KEY, `${title}|${detail}`);
      router.push(listHref);
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
    router.push(listHref);
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
        <p className="eyebrow">{isAdmin ? `Admin / Sửa sự kiện của BCH ${event?.createdBy?.fullName ?? ''}` : 'BCH / Ban Chấp hành'}</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-navy sm:text-[32px]">{isEdit ? 'Sửa brief sự kiện' : 'Tạo brief sự kiện'}</h1>
            <p className="mt-1.5 text-sm text-muted">Biến kế hoạch sự kiện thành các task media rõ ràng, dễ theo dõi.</p>
          </div>
          <Link href={listHref}>
            <Button variant="outline" icon={<ArrowLeft className="size-4" />}>
              {isAdmin ? 'Về quản lý sự kiện' : 'Về sự kiện của tôi'}
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
            </div>
            {/* Lịch diễn ra: x ngày, mỗi ngày chọn ngày + giờ riêng (không cần liên tiếp) */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-navy">Sự kiện diễn ra trong *</p>
                  <p className="text-[11px] text-muted">Các ngày không cần liên tiếp — chọn đúng từng ngày tổ chức.</p>
                </div>
                <Stepper value={days.length} min={1} max={MAX_DAYS} onChange={setDayCount} suffix="ngày" label="số ngày" />
              </div>
              {days.map((d, i) => (
                <div key={d.key} className="grid gap-2 border-t border-line pt-3 first-of-type:border-0 sm:grid-cols-[64px_1fr_1fr_auto] sm:items-end sm:border-0 sm:pt-0">
                  {/* Mobile: nhãn + nút xoá cùng một hàng; desktop: tách thành cột đầu / cột cuối */}
                  <div className="flex items-center justify-between sm:contents">
                    <span className="text-xs font-medium text-primary sm:pb-2.5">Ngày {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeDay(d.key)}
                      disabled={days.length === 1}
                      aria-label={`Bỏ ngày ${i + 1}`}
                      className="rounded p-1.5 text-primary hover:bg-white disabled:opacity-30 sm:order-last sm:mb-1 sm:justify-self-end"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <DatePicker value={d.date} onChange={(v) => updateDay(d.key, { date: v })} min={isEdit ? undefined : today} />
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <TimePicker value={d.start} onChange={(v) => updateDay(d.key, { start: v })} />
                    <span className="text-muted">–</span>
                    <TimePicker value={d.end} onChange={(v) => updateDay(d.key, { end: v })} />
                  </div>
                </div>
              ))}
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
                const count = deliverables.filter((d) => d.type === t).length;
                const on = count > 0;
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
                    {t === 'OTHER' ? (
                      <Plus className="size-4 text-primary" />
                    ) : on ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4 text-line" />
                    )}
                    {t === 'OTHER' ? 'Ấn phẩm khác' : TASK_TYPE_LABEL[t]}
                    {t === 'OTHER' && count > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-white">{count}</span>}
                  </button>
                );
              })}
            </div>
            <p className="flex items-start gap-2 text-[11px] text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Backdrop, Bandroll và Standee bắt buộc nhập kích thước. Bấm “Ấn phẩm khác” nhiều lần để thêm nhiều ấn phẩm khác, mỗi cái cần tên loại. Mọi ấn phẩm cần hạn chót.
            </p>

            {deliverables.map((d) => {
              const t = d.type;
              const required = DIM_REQUIRED.includes(t);
              const otherNo = t === 'OTHER' ? deliverables.filter((x) => x.type === 'OTHER').indexOf(d) + 1 : 0;
              const label = t === 'OTHER' ? `Ấn phẩm khác #${otherNo}${d.title.trim() ? ` · ${d.title.trim()}` : ''}` : TASK_TYPE_LABEL[t];
              return (
                <div key={d.key} className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-navy">
                      <CheckCircle2 className="size-4 text-primary" /> {label}
                    </span>
                    <button type="button" onClick={() => removeDeliverable(d.key)} aria-label={`Bỏ ${label}`} className="rounded p-1 hover:bg-white">
                      <X className="size-4 text-primary" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      {t === 'OTHER' && (
                        <Field label="Loại ấn phẩm *">
                          <input className="input" value={d.title} onChange={(e) => updateDeliverable(d.key, { title: e.target.value })} placeholder="Instagram story" />
                        </Field>
                      )}
                      <Field label={`Kích thước ${required ? '*' : '(tuỳ chọn)'}`} hint={required ? 'Bắt buộc cho bản in.' : undefined}>
                        <input className="input" value={d.dimensions} onChange={(e) => updateDeliverable(d.key, { dimensions: e.target.value })} placeholder="1920 × 1080 px" />
                      </Field>
                    </div>
                    <Field custom label="Hạn chót *" hint="ICT (UTC+7)">
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <DatePicker value={d.date} onChange={(v) => updateDeliverable(d.key, { date: v })} />
                        <TimePicker value={d.time} onChange={(v) => updateDeliverable(d.key, { time: v })} />
                      </div>
                    </Field>
                  </div>
                </div>
              );
            })}
            {deliverables.some((d) => d.type === 'OTHER') && (
              <Button variant="outline" size="sm" className="self-start" icon={<Plus className="size-4" />} onClick={() => toggleDeliverable('OTHER')}>
                Thêm ấn phẩm khác
              </Button>
            )}
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
            <Field
              custom
              label="File mẫu / tham chiếu (tuỳ chọn)"
              hint={`PDF, ảnh (PNG, JPG, WEBP, SVG…), AI, PSD, Word, PowerPoint, Excel, ZIP · tối đa ${MAX_ATTACHMENT_MB} MB/file, ${MAX_ATTACHMENTS} file.`}
            >
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cx(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition',
                  dragOver ? 'border-primary bg-ice' : 'border-line bg-soft hover:bg-ice',
                )}
              >
                <Upload className="size-5 text-primary" />
                <span className="text-xs text-navy">Kéo thả file vào đây hoặc bấm để chọn</span>
                <span className="text-[11px] text-muted">Có thể chọn nhiều file cùng lúc</span>
                <input
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = ''; // cho phép chọn lại cùng file
                  }}
                />
              </label>
            </Field>
            {fileErrors.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-[11px] text-danger">
                {fileErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {fileCount > 0 && (
              <ul className="flex flex-col gap-2">
                {savedFiles.map((f) => (
                  <FileRow key={`s${f.id}`} name={f.fileName} size={f.sizeBytes} onRemove={() => removeSavedFile(f.id)} />
                ))}
                {newFiles.map((f, i) => (
                  <FileRow key={`n${i}-${f.name}`} name={f.name} size={f.size} pending onRemove={() => setNewFiles((cur) => cur.filter((_, j) => j !== i))} />
                ))}
              </ul>
            )}
          </section>

          {/* 04 */}
          <section className="card flex flex-col gap-4 p-5">
            <SectionTitle no="04" title="Chụp ảnh sự kiện" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-navy">Phân công người chụp ảnh theo từng ngày</p>
                <p className="text-[11px] text-muted">Chọn ngày nào cần chụp, chụp từ mấy giờ đến mấy giờ và cần bao nhiêu người.</p>
              </div>
              <Toggle checked={photoNeeded} onChange={setPhotoNeeded} label="Cần chụp ảnh" />
            </div>
            {photoNeeded && (
              <div className="flex flex-col gap-2">
                {days.map((d, i) => (
                  <div
                    key={d.key}
                    className={cx(
                      'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center',
                      d.photo.on ? 'border-primary bg-ice' : 'border-line bg-white',
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={d.photo.on}
                      onClick={() => updatePhoto(d.key, { on: !d.photo.on })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {d.photo.on ? <CheckSquare className="size-4 shrink-0 text-primary" /> : <Square className="size-4 shrink-0 text-line" />}
                      <span className="min-w-0">
                        <span className="block text-xs text-navy">Ngày {i + 1}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {d.date ? `${formatYmd(d.date)} · sự kiện ${d.start}–${d.end}` : 'Chưa chọn ngày ở mục 01'}
                        </span>
                      </span>
                    </button>
                    {d.photo.on && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="grid w-[230px] grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                          <TimePicker value={d.photo.start} onChange={(v) => updatePhoto(d.key, { start: v })} />
                          <span className="text-muted">–</span>
                          <TimePicker value={d.photo.end} onChange={(v) => updatePhoto(d.key, { end: v })} />
                        </div>
                        <Stepper value={d.photo.quantity} min={1} max={20} onChange={(v) => updatePhoto(d.key, { quantity: v })} suffix="người" label="số người chụp" />
                      </div>
                    )}
                  </div>
                ))}
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
                {deliverables.length} ấn phẩm · {photoDays.length ? `chụp ảnh ${photoDays.length} ngày (${photoTotal} lượt người)` : 'không chụp ảnh'} · {taskCount} task cho {memberIds.length} BTT
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
            <div className="flex items-start gap-2 text-[11px] text-navy">
              <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {sortedDates.length === 0 ? (
                'Chưa chọn ngày'
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {[...days]
                    .filter((d) => d.date)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((d) => (
                      <li key={d.key}>
                        {formatYmd(d.date)} · {d.start}–{d.end}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <p className="flex items-center gap-2 text-[11px] text-navy">
              <MapPin className="size-3.5 text-primary" /> {info.location || 'Chưa có địa điểm'}
            </p>
            <div className="h-px bg-divider" />
            <Row label="Số ngày diễn ra" value={days.length} />
            <Row label="Ấn phẩm media" value={deliverables.length} />
            <Row label="Ngày cần chụp ảnh" value={photoDays.length} />
            <Row label="Lượt người chụp" value={photoTotal} />
            <Row label="File tham chiếu" value={fileCount} />
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

/** Nút − số + (số ngày, số người chụp) */
function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  label: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-white">
      <button type="button" className="p-2.5 text-primary disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Giảm ${label}`}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-[56px] text-center text-sm text-navy">
        {value}
        {suffix && <span className="ml-1 text-[11px] text-muted">{suffix}</span>}
      </span>
      <button type="button" className="p-2.5 text-primary disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Tăng ${label}`}>
        <Plus className="size-4" />
      </button>
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

function FileRow({ name, size, pending, onRemove }: { name: string; size: number; pending?: boolean; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
      <FileText className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-navy">{name}</p>
        <p className="text-[11px] text-muted">
          {fmtBytes(size)}
          {pending && ' · tải lên khi lưu'}
        </p>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Bỏ ${name}`} className="rounded p-1 hover:bg-soft">
        <X className="size-4 text-primary" />
      </button>
    </li>
  );
}
