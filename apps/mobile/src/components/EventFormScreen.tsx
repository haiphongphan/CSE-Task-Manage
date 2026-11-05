// BCH · Form tạo / sửa sự kiện (Figma: "BCH event and task creation · Mobile")
// BTT phụ trách được chọn ngay trong mục 01; mọi task giao cho cả nhóm, không giao riêng từng người.
import { openTab } from '@/lib/workspace';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateField, MemberPicker, TimeField, formatYmd } from './pickers';
import { Alert, Badge, Button, Card, ErrorBox, Field, Icon, Input, Loading, PageHeader, Screen, T, Toggle } from './ui';
import { api, type ApiError } from '@/lib/api';
import { useRoleAllowed } from '@/lib/auth';
import { setFlash } from '@/lib/flash';
import { useApi } from '@/lib/useApi';
import { fromInputs, TASK_TYPE_LABEL, toDateInput, toTimeInput } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { EventDetail, MiniUser } from '@/lib/types';

const DELIVERABLES = ['BANNER', 'BACKDROP', 'BANDROLL', 'STANDEE', 'INVITATION_LETTER', 'OTHER'] as const;
type DType = (typeof DELIVERABLES)[number];
const DIM_REQUIRED: DType[] = ['BACKDROP', 'BANDROLL', 'STANDEE'];

/** Một ấn phẩm. "Khác" có thể thêm nhiều cái */
interface DState {
  key: string;
  id?: number;
  type: DType;
  title: string;
  dimensions: string;
  date: string;
  time: string;
}

/** Một ngày diễn ra + lịch chụp của ngày đó (các ngày không cần liên tiếp) */
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
const newDay = (date = '', start = '09:00', end = '16:00', photoOn = true): DayState => ({
  key: newKey(),
  date,
  start,
  end,
  photo: { on: photoOn, start, end, quantity: 1 },
});

function initialDays(event?: EventDetail): DayState[] {
  if (!event) return [newDay()];
  const sessions = event.sessions?.length ? event.sessions : [{ startsAt: event.startsAt, endsAt: event.endsAt }];
  return sessions.map((x) => {
    const date = toDateInput(x.startsAt);
    const slot = event.photoSlots?.find((p) => toDateInput(p.startsAt) === date);
    const day = newDay(date, toTimeInput(x.startsAt), toTimeInput(x.endsAt), !!slot);
    if (slot) day.photo = { on: true, start: toTimeInput(slot.startsAt), end: toTimeInput(slot.endsAt), quantity: slot.quantity };
    return day;
  });
}

const dayBefore = (date: string) => {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** id có giá trị = sửa sự kiện; không có = tạo mới. onSaved: báo cho tab "Tạo sự kiện" để làm trống form */
export function EventFormScreen({ id, onSaved }: { id?: string; onSaved?: () => void }) {
  const ok = useRoleAllowed('BCH');
  const existing = useApi<{ event: EventDetail }>(ok && id ? `/events/${id}` : null);
  if (!ok) return <Loading />;
  if (id) {
    if (existing.error) return <Screen><ErrorBox message={existing.error} /></Screen>;
    if (!existing.data) return <Loading />;
    if (!existing.data.event.permissions.canEdit) {
      return (
        <Screen>
          <ErrorBox message="Sự kiện đã diễn ra nên không thể chỉnh sửa." />
        </Screen>
      );
    }
    return <EventForm key={id} event={existing.data.event} />;
  }
  return <EventForm onSaved={onSaved} />;
}

function EventForm({ event, onSaved }: { event?: EventDetail; onSaved?: () => void }) {
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
  const [items, setItems] = useState<DState[]>(() =>
    (event?.tasks ?? [])
      .filter((t) => (DELIVERABLES as readonly string[]).includes(t.type))
      .sort((a, b) => DELIVERABLES.indexOf(a.type as DType) - DELIVERABLES.indexOf(b.type as DType) || a.id - b.id)
      .map((t) => ({
        key: newKey(),
        id: t.id,
        type: t.type as DType,
        title: t.type === 'OTHER' ? t.title : '',
        dimensions: t.dimensions ?? '',
        date: toDateInput(t.deadline),
        time: toTimeInput(t.deadline),
      })),
  );
  const [days, setDays] = useState<DayState[]>(() => initialDays(event));
  const [photoNeeded, setPhotoNeeded] = useState(event?.photographerNeeded ?? true);
  const [memberIds, setMemberIds] = useState<number[]>(event?.members.map((m) => m.id) ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const photoDays = photoNeeded ? days.filter((d) => d.photo.on) : [];
  const photoTotal = photoDays.reduce((n, d) => n + d.photo.quantity, 0);
  const taskCount = items.length + (photoDays.length ? 1 : 0) + 1;
  const sortedDates = days.map((d) => d.date).filter(Boolean).sort();
  const today = toDateInput(new Date().toISOString());

  const setI = (k: keyof typeof info) => (v: string) => setInfo({ ...info, [k]: v });
  const blank = (type: DType): DState => ({ key: newKey(), type, title: '', dimensions: '', date: dayBefore(sortedDates[0] ?? ''), time: '17:00' });
  /** Loại thường: bật/tắt. "Ấn phẩm khác": mỗi lần bấm thêm một ấn phẩm mới */
  const toggleItem = (t: DType) =>
    setItems((cur) => {
      if (t === 'OTHER') return [...cur, blank('OTHER')];
      if (cur.some((d) => d.type === t)) return cur.filter((d) => d.type !== t);
      return [...cur, blank(t)].sort((a, b) => DELIVERABLES.indexOf(a.type) - DELIVERABLES.indexOf(b.type));
    });
  const removeItem = (key: string) => setItems((cur) => cur.filter((d) => d.key !== key));
  const updateItem = (key: string, patch: Partial<DState>) => setItems((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const updateDay = (key: string, patch: Partial<Omit<DayState, 'photo'>>) =>
    setDays((cur) =>
      cur.map((d) => {
        if (d.key !== key) return d;
        const next = { ...d, ...patch };
        if (patch.start !== undefined && d.photo.start === d.start) next.photo = { ...next.photo, start: patch.start };
        if (patch.end !== undefined && d.photo.end === d.end) next.photo = { ...next.photo, end: patch.end };
        return next;
      }),
    );
  const updatePhoto = (key: string, patch: Partial<DayState['photo']>) =>
    setDays((cur) => cur.map((d) => (d.key === key ? { ...d, photo: { ...d.photo, ...patch } } : d)));
  const setDayCount = (n: number) =>
    setDays((cur) => {
      const count = Math.min(MAX_DAYS, Math.max(1, n));
      if (count <= cur.length) return cur.slice(0, count);
      const last = cur[cur.length - 1];
      return [...cur, ...Array.from({ length: count - cur.length }, () => newDay('', last.start, last.end, last.photo.on))];
    });
  const removeDay = (key: string) => setDays((cur) => (cur.length > 1 ? cur.filter((d) => d.key !== key) : cur));

  function validate(publish: boolean) {
    const errs: string[] = [];
    if (info.name.trim().length < 3) errs.push('Tên sự kiện tối thiểu 3 ký tự');
    if (!info.location.trim()) errs.push('Vui lòng nhập địa điểm');
    days.forEach((d, i) => {
      if (!d.date) errs.push(`Ngày ${i + 1}: vui lòng chọn ngày`);
      if (d.end <= d.start) errs.push(`Ngày ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`);
      if (photoNeeded && d.photo.on && d.photo.end <= d.photo.start) errs.push(`Chụp ảnh ngày ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`);
    });
    if (new Set(sortedDates).size !== sortedDates.length) errs.push('Có ngày diễn ra bị chọn trùng');
    if (publish && memberIds.length === 0) errs.push('Chọn ít nhất 1 thành viên BTT phụ trách (mục 01)');
    let otherNo = 0;
    for (const d of items) {
      const label = d.type === 'OTHER' ? `Ấn phẩm khác #${++otherNo}` : TASK_TYPE_LABEL[d.type];
      if (DIM_REQUIRED.includes(d.type) && !d.dimensions.trim()) errs.push(`${label}: cần nhập kích thước`);
      if (d.type === 'OTHER' && !d.title.trim()) errs.push(`${label}: cần nhập loại ấn phẩm`);
      if (!d.date || !d.time) errs.push(`${label}: cần chọn hạn chót`);
    }
    if (photoNeeded && photoDays.length === 0) errs.push('Chụp ảnh: chọn ít nhất 1 ngày cần chụp, hoặc tắt chụp ảnh');
    if (publish && items.length === 0 && photoDays.length === 0) errs.push('Chọn ít nhất 1 ấn phẩm hoặc bật chụp ảnh');
    return errs;
  }

  async function submit(publish: boolean) {
    const errs = validate(publish);
    setErrors(errs);
    if (errs.length) return;
    const body = {
      name: info.name,
      location: info.location,
      sessions: days.map((d) => ({ startsAt: fromInputs(d.date, d.start), endsAt: fromInputs(d.date, d.end) })),
      notes: info.notes || null,
      onlineContent: info.onlineContent || null,
      offlineContent: info.offlineContent || null,
      photoSlots: photoDays.map((d) => ({ startsAt: fromInputs(d.date, d.photo.start), endsAt: fromInputs(d.date, d.photo.end), quantity: d.photo.quantity })),
      memberIds,
      deliverables: items.map((d) => ({
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
      const res = await api<{ event: EventDetail }>(isEdit ? `/events/${event.id}` : '/events', { method: isEdit ? 'PUT' : 'POST', body });
      setFlash(
        publish
          ? isEdit && !isDraft
            ? `Đã lưu thay đổi “${res.event.name}”.`
            : `Đã tạo “${res.event.name}” và phân công cho ${memberIds.length} BTT.`
          : `Đã lưu nháp “${res.event.name}”.`,
      );
      onSaved?.();
      if (isEdit) router.back(); // đóng màn sửa
      openTab('bch/events');
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.details?.map((d) => d.message) ?? [err.message]);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen>
      <PageHeader eyebrow="BCH / Ban Chấp hành" title={isEdit ? 'Sửa brief sự kiện' : 'Tạo brief sự kiện'} description="Biến kế hoạch sự kiện thành các task media rõ ràng, dễ theo dõi." />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Badge tone="navy">{isDraft ? 'Nháp' : 'Đã gửi'}</Badge>
        <T size={11} color={colors.muted}>
          Mọi giờ theo ICT · * Bắt buộc
        </T>
      </View>
      {errors.length > 0 && <Alert tone="error">{'Vui lòng kiểm tra lại:\n• ' + errors.join('\n• ')}</Alert>}

      {/* 01 */}
      <Card style={{ gap: 14 }}>
        <Section no="01" title="Thông tin chung" desc="Những gì đội media cần biết." />
        <Field label="Tên sự kiện *">
          <Input value={info.name} onChangeText={setI('name')} placeholder="Ngày hội Sáng tạo CSE" autoCapitalize="sentences" />
        </Field>
        <Field label="Địa điểm *">
          <Input value={info.location} onChangeText={setI('location')} icon="map-pin" autoCapitalize="sentences" />
        </Field>
        {/* Sự kiện diễn ra trong x ngày; mỗi ngày chọn ngày + giờ riêng, không cần liên tiếp */}
        <View style={{ backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T size={12}>Sự kiện diễn ra trong *</T>
              <T size={11} color={colors.muted}>
                Các ngày không cần liên tiếp.
              </T>
            </View>
            <Stepper value={days.length} min={1} max={MAX_DAYS} onChange={setDayCount} suffix="ngày" />
          </View>
          {days.map((d, i) => (
            <View key={d.key} style={{ gap: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.line, paddingTop: i ? 12 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={12} color={colors.primary}>
                  Ngày {i + 1}
                </T>
                {days.length > 1 && (
                  <Pressable onPress={() => removeDay(d.key)} hitSlop={10} accessibilityLabel={`Bỏ ngày ${i + 1}`}>
                    <Icon name="trash-2" />
                  </Pressable>
                )}
              </View>
              <DateField value={d.date} onChange={(v) => updateDay(d.key, { date: v })} title={`Ngày ${i + 1}`} min={isEdit ? undefined : today} />
              <TimeRow start={d.start} end={d.end} onStart={(v) => updateDay(d.key, { start: v })} onEnd={(v) => updateDay(d.key, { end: v })} />
            </View>
          ))}
        </View>
        <Field label="Ban Truyền thông phụ trách *" hint="Cả nhóm cùng phụ trách mọi task và nhận bản tin nhắc việc lúc 09:00 mỗi ngày.">
          <MemberPicker people={btts} value={memberIds} onChange={setMemberIds} placeholder="Chọn thành viên BTT" />
        </Field>
        <Field label="Ghi chú chi tiết / Thông tin recap">
          <Input value={info.notes} onChangeText={setI('notes')} multiline autoCapitalize="sentences" />
        </Field>
      </Card>

      {/* 02 */}
      <Card style={{ gap: 14 }}>
        <Section no="02" title="Chọn ấn phẩm media" desc="Mỗi ấn phẩm là một task có hạn chót riêng." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DELIVERABLES.map((t) => {
            const count = items.filter((d) => d.type === t).length;
            const on = count > 0;
            return (
              <Pressable
                key={t}
                onPress={() => toggleItem(t)}
                style={{ width: '48%', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.ice : colors.white }}
              >
                <Icon name={t === 'OTHER' ? 'plus' : on ? 'check-square' : 'square'} color={on || t === 'OTHER' ? colors.primary : colors.line} />
                <T size={12} style={{ flex: 1 }}>
                  {t === 'OTHER' ? 'Ấn phẩm khác' : TASK_TYPE_LABEL[t]}
                </T>
                {t === 'OTHER' && count > 0 && <Badge>{String(count)}</Badge>}
              </Pressable>
            );
          })}
        </View>
        <T size={11} color={colors.muted}>
          Backdrop, Bandroll và Standee bắt buộc nhập kích thước. Bấm “Ấn phẩm khác” nhiều lần để thêm nhiều ấn phẩm khác.
        </T>
        {items.map((d) => {
          const t = d.type;
          const otherNo = t === 'OTHER' ? items.filter((x) => x.type === 'OTHER').indexOf(d) + 1 : 0;
          const label = t === 'OTHER' ? `Ấn phẩm khác #${otherNo}${d.title.trim() ? ` · ${d.title.trim()}` : ''}` : TASK_TYPE_LABEL[t];
          return (
            <View key={d.key} style={{ backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flex: 1 }}>
                  <Icon name="check-circle" size={15} />
                  <T numberOfLines={1} style={{ flex: 1 }}>
                    {label}
                  </T>
                </View>
                <Pressable onPress={() => removeItem(d.key)} hitSlop={10}>
                  <Icon name="x" />
                </Pressable>
              </View>
              {t === 'OTHER' && (
                <Field label="Loại ấn phẩm *">
                  <Input value={d.title} onChangeText={(v) => updateItem(d.key, { title: v })} placeholder="Instagram story" autoCapitalize="sentences" />
                </Field>
              )}
              <Field label={`Kích thước ${DIM_REQUIRED.includes(t) ? '*' : '(tuỳ chọn)'}`}>
                <Input value={d.dimensions} onChangeText={(v) => updateItem(d.key, { dimensions: v })} placeholder="1920 × 1080 px" />
              </Field>
              <Field label="Hạn chót *" hint="ICT (UTC+7)">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 3 }}>
                    <DateField value={d.date} onChange={(v) => updateItem(d.key, { date: v })} title={`Hạn chót · ${label}`} />
                  </View>
                  <View style={{ flex: 2 }}>
                    <TimeField value={d.time} onChange={(v) => updateItem(d.key, { time: v })} title={`Giờ hạn chót · ${label}`} />
                  </View>
                </View>
              </Field>
            </View>
          );
        })}
        {items.some((d) => d.type === 'OTHER') && <Button title="Thêm ấn phẩm khác" icon="plus" variant="outline" onPress={() => toggleItem('OTHER')} />}
      </Card>

      {/* 03 */}
      <Card style={{ gap: 14 }}>
        <Section no="03" title="Nội dung ấn phẩm" desc="Giữ thông điệp online và in ấn thống nhất." />
        <Field label="Nội dung ấn phẩm online">
          <Input value={info.onlineContent} onChangeText={setI('onlineContent')} multiline autoCapitalize="sentences" />
        </Field>
        <Field label="Nội dung ấn phẩm in ấn">
          <Input value={info.offlineContent} onChangeText={setI('offlineContent')} multiline autoCapitalize="sentences" />
        </Field>
      </Card>

      {/* 04 */}
      <Card style={{ gap: 14 }}>
        <Section no="04" title="Chụp ảnh sự kiện" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T>Phân công người chụp ảnh theo từng ngày</T>
            <T size={11} color={colors.muted}>
              Chọn ngày cần chụp, giờ chụp và số người.
            </T>
          </View>
          <Toggle value={photoNeeded} onChange={setPhotoNeeded} />
        </View>
        {photoNeeded &&
          days.map((d, i) => (
            <View key={d.key} style={{ borderWidth: 1, borderColor: d.photo.on ? colors.primary : colors.line, backgroundColor: d.photo.on ? colors.ice : colors.white, borderRadius: 12, padding: 12, gap: 10 }}>
              <Pressable onPress={() => updatePhoto(d.key, { on: !d.photo.on })} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: d.photo.on }}>
                <Icon name={d.photo.on ? 'check-square' : 'square'} color={d.photo.on ? colors.primary : colors.line} />
                <View style={{ flex: 1 }}>
                  <T size={12}>Ngày {i + 1}</T>
                  <T size={11} color={colors.muted}>
                    {d.date ? `${formatYmd(d.date)} · sự kiện ${d.start}–${d.end}` : 'Chưa chọn ngày ở mục 01'}
                  </T>
                </View>
              </Pressable>
              {d.photo.on && (
                <>
                  <TimeRow start={d.photo.start} end={d.photo.end} onStart={(v) => updatePhoto(d.key, { start: v })} onEnd={(v) => updatePhoto(d.key, { end: v })} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T size={12}>Số người chụp *</T>
                    <Stepper value={d.photo.quantity} min={1} max={20} onChange={(v) => updatePhoto(d.key, { quantity: v })} suffix="người" />
                  </View>
                </>
              )}
            </View>
          ))}
        <T size={11} color={colors.muted}>
          Task chụp ảnh vào bản tin hằng ngày của BTT từ 3 ngày trước sự kiện; recap ngay sau khi sự kiện kết thúc (hạn 7 ngày).
        </T>
      </Card>

      <Card style={{ gap: 10 }}>
        <T>Sẵn sàng gửi cho đội media?</T>
        <T size={11} color={colors.muted}>
          {days.length} ngày · {items.length} ấn phẩm · {photoDays.length ? `chụp ảnh ${photoDays.length} ngày (${photoTotal} lượt người)` : 'không chụp ảnh'} · {taskCount} task cho {memberIds.length} BTT
        </T>
        <Button title={isDraft ? 'Gửi & phân công task' : 'Lưu thay đổi'} icon="arrow-right" onPress={() => submit(true)} loading={saving === 'publish'} disabled={!!saving} />
        {isDraft && <Button title="Lưu nháp" variant="outline" onPress={() => submit(false)} loading={saving === 'draft'} disabled={!!saving} />}
        {isEdit && isDraft && (
          <Button
            title="Xoá nháp"
            variant="danger"
            icon="trash-2"
            onPress={async () => {
              await api(`/events/${event.id}`, { method: 'DELETE' });
              setFlash('Đã xoá bản nháp.');
              router.back();
            }}
          />
        )}
      </Card>
    </Screen>
  );
}

/** Giờ từ – đến */
function TimeRow({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <TimeField value={start} onChange={onStart} title="Giờ bắt đầu" />
      </View>
      <T color={colors.muted}>–</T>
      <View style={{ flex: 1 }}>
        <TimeField value={end} onChange={onEnd} title="Giờ kết thúc" />
      </View>
    </View>
  );
}

/** Nút − số + */
function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.white }}>
      <Pressable style={{ padding: 10, opacity: value <= min ? 0.3 : 1 }} disabled={value <= min} onPress={() => onChange(value - 1)}>
        <Icon name="minus" />
      </Pressable>
      <T style={{ minWidth: 52, textAlign: 'center' }}>
        {value}
        {suffix ? <T size={11} color={colors.muted}>{` ${suffix}`}</T> : null}
      </T>
      <Pressable style={{ padding: 10, opacity: value >= max ? 0.3 : 1 }} disabled={value >= max} onPress={() => onChange(value + 1)}>
        <Icon name="plus" />
      </Pressable>
    </View>
  );
}

function Section({ no, title, desc }: { no: string; title: string; desc?: string }) {
  return (
    <View>
      <T size={16}>
        {no} · {title}
      </T>
      {desc && (
        <T size={11} color={colors.muted}>
          {desc}
        </T>
      )}
    </View>
  );
}
