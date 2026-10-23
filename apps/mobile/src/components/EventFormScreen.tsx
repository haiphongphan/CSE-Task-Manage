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

interface DState {
  id?: number;
  title: string;
  dimensions: string;
  date: string;
  time: string;
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
    date: event ? toDateInput(event.startsAt) : '',
    startTime: event ? toTimeInput(event.startsAt) : '09:00',
    endTime: event ? toTimeInput(event.endsAt) : '16:00',
    notes: event?.notes ?? '',
    onlineContent: event?.onlineContent ?? '',
    offlineContent: event?.offlineContent ?? '',
  });
  const [items, setItems] = useState<Partial<Record<DType, DState>>>(() => {
    const map: Partial<Record<DType, DState>> = {};
    event?.tasks
      .filter((t) => (DELIVERABLES as readonly string[]).includes(t.type))
      .forEach((t) => {
        map[t.type as DType] = {
          id: t.id,
          title: t.type === 'OTHER' ? t.title : '',
          dimensions: t.dimensions ?? '',
          date: toDateInput(t.deadline),
          time: toTimeInput(t.deadline),
        };
      });
    return map;
  });
  const [photo, setPhoto] = useState({ needed: event?.photographerNeeded ?? true, quantity: event?.photographerQuantity || 1 });
  const [memberIds, setMemberIds] = useState<number[]>(event?.members.map((m) => m.id) ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const selected = DELIVERABLES.filter((t) => items[t]);
  const taskCount = selected.length + (photo.needed ? 1 : 0) + 1;
  const today = toDateInput(new Date().toISOString());

  const setI = (k: keyof typeof info) => (v: string) => setInfo({ ...info, [k]: v });
  const toggleItem = (t: DType) =>
    setItems((cur) => {
      const next = { ...cur };
      if (next[t]) delete next[t];
      else next[t] = { title: '', dimensions: '', date: dayBefore(info.date), time: '17:00' };
      return next;
    });
  const updateItem = (t: DType, patch: Partial<DState>) => setItems((cur) => ({ ...cur, [t]: { ...cur[t]!, ...patch } }));

  function validate(publish: boolean) {
    const errs: string[] = [];
    if (info.name.trim().length < 3) errs.push('Tên sự kiện tối thiểu 3 ký tự');
    if (!info.location.trim()) errs.push('Vui lòng nhập địa điểm');
    if (!info.date) errs.push('Vui lòng chọn ngày sự kiện');
    if (info.endTime <= info.startTime) errs.push('Giờ kết thúc phải sau giờ bắt đầu');
    if (publish && memberIds.length === 0) errs.push('Chọn ít nhất 1 thành viên BTT phụ trách (mục 01)');
    for (const t of selected) {
      const d = items[t]!;
      if (DIM_REQUIRED.includes(t) && !d.dimensions.trim()) errs.push(`${TASK_TYPE_LABEL[t]}: cần nhập kích thước`);
      if (t === 'OTHER' && !d.title.trim()) errs.push('Ấn phẩm “Khác”: cần nhập loại ấn phẩm');
      if (!d.date || !d.time) errs.push(`${TASK_TYPE_LABEL[t]}: cần chọn hạn chót`);
    }
    if (publish && selected.length === 0 && !photo.needed) errs.push('Chọn ít nhất 1 ấn phẩm hoặc bật chụp ảnh');
    return errs;
  }

  async function submit(publish: boolean) {
    const errs = validate(publish);
    setErrors(errs);
    if (errs.length) return;
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
      deliverables: selected.map((type) => {
        const d = items[type]!;
        return { id: d.id, type, title: type === 'OTHER' ? d.title : undefined, dimensions: d.dimensions || null, deadline: fromInputs(d.date, d.time) };
      }),
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
        <Field label="Ngày diễn ra *">
          <DateField value={info.date} onChange={setI('date')} title="Ngày diễn ra" min={isEdit ? undefined : today} />
        </Field>
        <Field label="Thời gian *">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TimeField value={info.startTime} onChange={setI('startTime')} title="Giờ bắt đầu" />
            </View>
            <T color={colors.muted}>–</T>
            <View style={{ flex: 1 }}>
              <TimeField value={info.endTime} onChange={setI('endTime')} title="Giờ kết thúc" />
            </View>
          </View>
        </Field>
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
            const on = !!items[t];
            return (
              <Pressable
                key={t}
                onPress={() => toggleItem(t)}
                style={{ width: '48%', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.ice : colors.white }}
              >
                <Icon name={on ? 'check-square' : 'square'} color={on ? colors.primary : colors.line} />
                <T size={12}>{TASK_TYPE_LABEL[t]}</T>
              </Pressable>
            );
          })}
        </View>
        <T size={11} color={colors.muted}>
          Backdrop, Bandroll và Standee bắt buộc nhập kích thước. “Khác” cần nhập loại ấn phẩm.
        </T>
        {selected.map((t) => {
          const d = items[t]!;
          return (
            <View key={t} style={{ backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Icon name="check-circle" size={15} />
                  <T>{TASK_TYPE_LABEL[t]}</T>
                </View>
                <Pressable onPress={() => toggleItem(t)} hitSlop={10}>
                  <Icon name="x" />
                </Pressable>
              </View>
              {t === 'OTHER' && (
                <Field label="Loại ấn phẩm *">
                  <Input value={d.title} onChangeText={(v) => updateItem(t, { title: v })} placeholder="Instagram story" autoCapitalize="sentences" />
                </Field>
              )}
              <Field label={`Kích thước ${DIM_REQUIRED.includes(t) ? '*' : '(tuỳ chọn)'}`}>
                <Input value={d.dimensions} onChangeText={(v) => updateItem(t, { dimensions: v })} placeholder="1920 × 1080 px" />
              </Field>
              <Field label="Hạn chót *" hint="ICT (UTC+7)">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 3 }}>
                    <DateField value={d.date} onChange={(v) => updateItem(t, { date: v })} title={`Hạn chót · ${TASK_TYPE_LABEL[t]}`} />
                  </View>
                  <View style={{ flex: 2 }}>
                    <TimeField value={d.time} onChange={(v) => updateItem(t, { time: v })} title={`Giờ hạn chót · ${TASK_TYPE_LABEL[t]}`} />
                  </View>
                </View>
              </Field>
            </View>
          );
        })}
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
            <T>Phân công người chụp ảnh cho ngày sự kiện</T>
            <T size={11} color={colors.muted}>
              Bật sẵn. Tắt nếu sự kiện không cần chụp ảnh.
            </T>
          </View>
          <Toggle value={photo.needed} onChange={(v) => setPhoto({ ...photo, needed: v })} />
        </View>
        {photo.needed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <T size={12}>Số người chụp *</T>
              <T size={11} color={colors.muted}>
                {info.date ? formatYmd(info.date) : 'Chọn ngày ở mục 01'}
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.white }}>
              <Pressable style={{ padding: 10 }} onPress={() => setPhoto({ ...photo, quantity: Math.max(1, photo.quantity - 1) })}>
                <Icon name="minus" />
              </Pressable>
              <T style={{ width: 28, textAlign: 'center' }}>{photo.quantity}</T>
              <Pressable style={{ padding: 10 }} onPress={() => setPhoto({ ...photo, quantity: Math.min(20, photo.quantity + 1) })}>
                <Icon name="plus" />
              </Pressable>
            </View>
          </View>
        )}
        <T size={11} color={colors.muted}>
          Task chụp ảnh vào bản tin hằng ngày của BTT từ 3 ngày trước sự kiện; recap từ hôm sau sự kiện (hạn 7 ngày).
        </T>
      </Card>

      <Card style={{ gap: 10 }}>
        <T>Sẵn sàng gửi cho đội media?</T>
        <T size={11} color={colors.muted}>
          {selected.length} ấn phẩm · {photo.needed ? `${photo.quantity} người chụp` : 'không chụp ảnh'} · {taskCount} task cho {memberIds.length} BTT
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
