// =====================================================================
// Bộ chọn tự thiết kế cho mobile, hiển thị dạng "bottom sheet" trượt từ dưới lên.
// Giống nhau trên iOS, Android và web (thay cho datetimepicker gốc của hệ điều hành).
//   <Sheet>        — khung trượt dùng chung (tay nắm, tiêu đề, nền mờ)
//   <Select>       — chọn 1 trong danh sách
//   <DateField>    — lịch tháng, giá trị 'YYYY-MM-DD'
//   <TimeField>    — giờ + phút, giá trị 'HH:mm'
//   <MemberPicker> — chọn nhiều thành viên (chip + tìm kiếm)
// =====================================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { initials } from '@/lib/format';
import { Button, Icon, T, styles, type IconName } from './ui';

// ---------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(3,4,94,0.35)' }} onPress={onClose} accessibilityLabel="Đóng" />
        <View
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: '85%',
            gap: 14,
            shadowColor: colors.navy,
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.divider }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T size={17} weight="medium">
                {title}
              </T>
              {subtitle && (
                <T size={12} color={colors.muted}>
                  {subtitle}
                </T>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} />
            </Pressable>
          </View>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

/** Ô giống ô nhập, bấm vào thì mở sheet */
function FieldButton({ label, placeholder, icon = 'chevron-down', onPress, disabled, compact }: {
  label?: string;
  placeholder: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.inputWrap,
        compact && { minHeight: 34, borderRadius: 17, paddingHorizontal: 12 },
        pressed && { borderColor: colors.primary },
        disabled && { opacity: 0.55 },
      ]}
    >
      <T size={compact ? 12 : 13} color={label ? colors.navy : colors.muted} style={{ flex: 1 }} numberOfLines={1}>
        {label ?? placeholder}
      </T>
      <Icon name={icon} size={compact ? 14 : 16} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------
export interface Option<V> {
  value: V;
  label: string;
  hint?: string;
}

export function Select<V extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  title = 'Chọn một mục',
  disabled,
  compact,
}: {
  value: V | null;
  onChange: (v: V) => void;
  options: Option<V>[];
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <FieldButton label={current?.label} placeholder={placeholder} onPress={() => setOpen(true)} disabled={disabled} compact={compact} />
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.divider,
                  backgroundColor: on ? colors.ice : pressed ? colors.soft : colors.white,
                })}
              >
                <View style={{ flex: 1 }}>
                  <T size={14} weight={on ? 'medium' : 'regular'} color={on ? colors.primary : colors.navy}>
                    {o.label}
                  </T>
                  {o.hint && (
                    <T size={11} color={colors.muted}>
                      {o.hint}
                    </T>
                  )}
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: on ? 0 : 1.5,
                    borderColor: colors.line,
                    backgroundColor: on ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on && <Icon name="check" size={13} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------
// DateField — lịch tháng
// ---------------------------------------------------------------------
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayYmd = () => {
  const d = new Date(Date.now() + 7 * 3_600_000); // giờ Việt Nam
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** "Thứ 6, 25/10/2026" */
export function formatYmd(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const [y, m, d] = v.split('-').map(Number);
  return `${WEEKDAY_FULL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${pad(d)}/${pad(m)}/${y}`;
}

export function DateField({ value, onChange, placeholder = 'Chọn ngày', title = 'Chọn ngày', min }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  title?: string;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [view, setView] = useState({ y: 2026, m: 0 });

  useEffect(() => {
    if (!open) return;
    const b = value || todayYmd();
    setDraft(value);
    setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 });
  }, [open, value]);

  const cells = useMemo(() => {
    const offset = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // tuần bắt đầu Thứ 2
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const list: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (list.length % 7) list.push(null);
    return list;
  }, [view]);

  const move = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  const today = todayYmd();

  return (
    <>
      <FieldButton label={formatYmd(value) || undefined} placeholder={placeholder} icon="calendar" onPress={() => setOpen(true)} />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={draft ? formatYmd(draft) : 'Chưa chọn ngày'}
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Hôm nay" variant="outline" style={{ flex: 1 }} onPress={() => (setDraft(today), setView({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))} />
            <Button title="Xong" icon="check" style={{ flex: 1 }} disabled={!draft} onPress={() => (onChange(draft), setOpen(false))} />
          </View>
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => move(-1)} hitSlop={10} style={calNav}>
            <Icon name="chevron-left" size={18} />
          </Pressable>
          <T size={15} weight="medium">
            Tháng {view.m + 1}, {view.y}
          </T>
          <Pressable onPress={() => move(1)} hitSlop={10} style={calNav}>
            <Icon name="chevron-right" size={18} />
          </Pressable>
        </View>
        <View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w) => (
              <T key={w} size={11} color={colors.muted} style={{ flex: 1, textAlign: 'center', paddingVertical: 4 }}>
                {w}
              </T>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                if (!d) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
                const v = ymd(view.y, view.m, d);
                const on = v === draft;
                const disabled = !!min && v < min;
                return (
                  <Pressable key={i} disabled={disabled} onPress={() => setDraft(v)} style={{ flex: 1, aspectRatio: 1, padding: 3 }}>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? colors.primary : 'transparent',
                        borderWidth: !on && v === today ? 1.5 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <T size={14} weight={on ? 'medium' : 'regular'} color={on ? colors.white : disabled ? colors.line : colors.navy}>
                        {d}
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}
const calNav = { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.soft, alignItems: 'center' as const, justifyContent: 'center' as const };

// ---------------------------------------------------------------------
// TimeField — chọn nhanh + cột giờ / cột phút
// ---------------------------------------------------------------------
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const QUICK = ['08:00', '09:00', '12:00', '14:00', '17:00', '18:00'];
const ROW_H = 44;

export function TimeField({ value, onChange, title = 'Chọn giờ' }: { value: string; onChange: (v: string) => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState('09');
  const [m, setM] = useState('00');
  const hourScroll = useRef<ScrollViewInstance>(null);
  const minScroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!open) return;
    const [hh = '09', mm = '00'] = value ? value.split(':') : [];
    setH(hh);
    setM(MINUTES.includes(mm) ? mm : '00');
    // cuộn tới giá trị đang chọn
    setTimeout(() => {
      hourScroll.current?.scrollTo({ y: Math.max(0, Number(hh) - 2) * ROW_H, animated: false });
      minScroll.current?.scrollTo({ y: Math.max(0, Number(mm) / 5 - 2) * ROW_H, animated: false });
    }, 50);
  }, [open, value]);

  const column = (items: string[], cur: string, set: (v: string) => void, ref: React.RefObject<ScrollViewInstance | null>, label: string) => (
    <View style={{ flex: 1, gap: 6 }}>
      <T size={11} color={colors.muted} upper style={{ textAlign: 'center' }}>
        {label}
      </T>
      <ScrollView ref={ref} style={{ height: ROW_H * 5, borderRadius: 12, backgroundColor: colors.soft }} showsVerticalScrollIndicator={false}>
        {items.map((x) => {
          const on = x === cur;
          return (
            <Pressable key={x} onPress={() => set(x)} style={{ height: ROW_H, padding: 4 }}>
              <View style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : 'transparent' }}>
                <T size={17} weight={on ? 'bold' : 'regular'} color={on ? colors.white : colors.navy}>
                  {x}
                </T>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <>
      <FieldButton label={value || undefined} placeholder="Chọn giờ" icon="clock" onPress={() => setOpen(true)} />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={`${h}:${m}`}
        footer={<Button title={`Chọn ${h}:${m}`} icon="check" onPress={() => (onChange(`${h}:${m}`), setOpen(false))} />}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK.map((q) => {
            const on = q === `${h}:${m}`;
            return (
              <Pressable
                key={q}
                onPress={() => (setH(q.slice(0, 2)), setM(q.slice(3)))}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.primary : colors.white }}
              >
                <T size={13} color={on ? colors.white : colors.primary}>
                  {q}
                </T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {column(HOURS, h, setH, hourScroll, 'Giờ')}
          <T size={24} weight="bold" style={{ marginTop: 18 }}>
            :
          </T>
          {column(MINUTES, m, setM, minScroll, 'Phút')}
        </View>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------
// MemberPicker — chọn nhiều thành viên
// ---------------------------------------------------------------------
export function MemberPicker({ people, value, onChange, placeholder = 'Chọn thành viên' }: {
  people: { id: number; fullName: string; username?: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = people.filter((p) => value.includes(p.id));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const filtered = people.filter((p) => `${p.fullName} ${p.username ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <View style={[styles.inputWrap, { flexWrap: 'wrap', paddingVertical: 8, gap: 6 }]}>
        {selected.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingLeft: 3, paddingRight: 8, paddingVertical: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' }}>
              <T size={9} weight="medium">
                {initials(p.fullName)}
              </T>
            </View>
            <T size={12}>{p.fullName}</T>
            <Pressable onPress={() => toggle(p.id)} hitSlop={8}>
              <Icon name="x" size={13} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Icon name="user-plus" size={14} />
          <T size={12} color={colors.primary}>
            {selected.length ? 'Thêm' : placeholder}
          </T>
        </Pressable>
      </View>
      <Sheet
        open={open}
        onClose={() => (setOpen(false), setQ(''))}
        title="Ban Truyền thông phụ trách"
        subtitle={`Đã chọn ${value.length} thành viên`}
        footer={<Button title="Xong" icon="check" onPress={() => (setOpen(false), setQ(''))} />}
      >
        <View style={[styles.inputWrap, { backgroundColor: colors.soft }]}>
          <Icon name="search" size={15} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Tìm theo tên..."
            placeholderTextColor="#7f97a8"
            autoCapitalize="none"
            style={{ flex: 1, minHeight: 44, fontSize: 14, color: colors.navy, fontFamily: fonts.regular, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as never}
          />
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          {filtered.map((p) => {
            const on = value.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.primary : colors.divider, backgroundColor: on ? colors.ice : colors.white }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: on ? 0 : 1.5, borderColor: colors.line, backgroundColor: on ? colors.primary : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Icon name="check" size={13} color={colors.white} />}
                </View>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={11} weight="medium">
                    {initials(p.fullName)}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T size={14}>{p.fullName}</T>
                  {p.username && (
                    <T size={11} color={colors.muted}>
                      @{p.username}
                    </T>
                  )}
                </View>
              </Pressable>
            );
          })}
          {!filtered.length && (
            <T color={colors.muted} style={{ textAlign: 'center', padding: 16 }}>
              Không tìm thấy
            </T>
          )}
        </ScrollView>
      </Sheet>
    </>
  );
}
