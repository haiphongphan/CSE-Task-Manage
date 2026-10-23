'use client';
// =====================================================================
// Bộ chọn tự thiết kế thay cho <select>, <input type="date|time"> mặc định
// của trình duyệt (mỗi trình duyệt một kiểu, không theo Figma).
//   <Dropdown>     — hộp thả xuống 1 lựa chọn
//   <DatePicker>   — lịch tháng, giá trị 'YYYY-MM-DD'
//   <TimePicker>   — chọn giờ/phút, giá trị 'HH:mm'
//   <MemberPicker> — chọn nhiều người (chip + ô tìm kiếm)
// Tất cả dùng chung <Popover>: bấm ra ngoài hoặc Esc để đóng.
// =====================================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Plus, Search, X } from 'lucide-react';
import { cx } from './ui';

// ---------------------------------------------------------------------
// Popover: khung nổi bám dưới nút bấm, tự lật lên trên nếu sát đáy màn hình
// ---------------------------------------------------------------------
function Popover({
  open,
  onClose,
  trigger,
  children,
  width,
  align = 'left',
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  width?: number | string;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Còn ít chỗ phía dưới -> mở lên trên
    const rect = ref.current?.getBoundingClientRect();
    setUp(!!rect && window.innerHeight - rect.bottom < 340 && rect.top > 340);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          className={cx(
            'absolute z-50 rounded-xl border border-line bg-white p-2 shadow-[0_12px_40px_-12px_rgba(3,4,94,0.35)]',
            'animate-[pop_120ms_ease-out]',
            up ? 'bottom-full mb-2' : 'top-full mt-2',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          style={{ width: width ?? '100%', minWidth: 200 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Nút trông giống ô nhập (dùng làm "trigger" cho các picker) */
function FieldButton({
  open,
  onClick,
  icon,
  children,
  placeholder,
  disabled,
  size = 'md',
  pill,
}: {
  open: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  pill?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      className={cx(
        'flex w-full items-center gap-2 border text-left text-navy transition disabled:cursor-not-allowed disabled:opacity-60',
        pill ? 'rounded-full' : 'rounded-lg',
        size === 'md' ? 'min-h-[46px] px-3 text-[13px]' : 'min-h-[34px] px-3 text-xs',
        open ? 'border-primary bg-white ring-2 ring-primary/20' : 'border-line bg-ice hover:border-primary/60',
      )}
    >
      <span className={cx('flex-1 truncate', !children && 'text-muted/80')}>{children ?? placeholder}</span>
      {icon ?? <ChevronDown className={cx('size-4 shrink-0 text-primary transition', open && 'rotate-180')} />}
    </button>
  );
}

// ---------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------
export interface Option<V> {
  value: V;
  label: string;
  hint?: string;
}

export function Dropdown<V extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled,
  size = 'md',
  pill,
  className,
  width,
  label,
}: {
  value: V | null | undefined;
  onChange: (v: V) => void;
  options: Option<V>[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  pill?: boolean;
  className?: string;
  width?: number | string;
  label?: string; // cho trình đọc màn hình
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const pick = (o: Option<V>) => {
    onChange(o.value);
    setOpen(false);
  };

  return (
    <div
      className={className}
      aria-label={label}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(options.length - 1, a + 1)));
        if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
        if (e.key === 'Enter') (e.preventDefault(), options[active] && pick(options[active]));
      }}
    >
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        width={width}
        trigger={
          <FieldButton open={open} onClick={() => setOpen(!open)} placeholder={placeholder} disabled={disabled} size={size} pill={pill}>
            {current?.label}
          </FieldButton>
        }
      >
        <ul role="listbox" className="max-h-72 overflow-y-auto">
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-navy',
                    i === active && 'bg-soft',
                    selected && 'font-medium text-primary',
                  )}
                >
                  <span className="flex-1">
                    {o.label}
                    {o.hint && <span className="block text-[11px] font-normal text-muted">{o.hint}</span>}
                  </span>
                  {selected && <Check className="size-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------
// DatePicker
// ---------------------------------------------------------------------
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayYmd = () => {
  // "Hôm nay" theo giờ Việt Nam
  const d = new Date(Date.now() + 7 * 3_600_000);
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** "Thứ 6, 25/10/2026" */
export function formatYmd(v: string) {
  if (!v) return '';
  const [y, m, d] = v.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_FULL[wd]}, ${pad(d)}/${pad(m)}/${y}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string; // không cho chọn trước ngày này
}) {
  const [open, setOpen] = useState(false);
  const base = value || todayYmd();
  const [view, setView] = useState(() => ({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }));

  useEffect(() => {
    if (open) {
      const b = value || todayYmd();
      setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 });
    }
  }, [open, value]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay(); // 0 = CN
    const offset = (first + 6) % 7; // tuần bắt đầu từ Thứ 2
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [view]);

  const today = todayYmd();
  const move = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={292}
      trigger={
        <FieldButton open={open} onClick={() => setOpen(!open)} placeholder={placeholder} icon={<CalendarDays className="size-4 shrink-0 text-primary" />}>
          {value ? formatYmd(value) : undefined}
        </FieldButton>
      }
    >
      <div className="p-1">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} className="rounded-lg p-1.5 text-primary hover:bg-soft" aria-label="Tháng trước">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium text-navy">
            Tháng {view.m + 1}, {view.y}
          </span>
          <button type="button" onClick={() => move(1)} className="rounded-lg p-1.5 text-primary hover:bg-soft" aria-label="Tháng sau">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 text-[11px] text-muted">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const v = ymd(view.y, view.m, d);
            const selected = v === value;
            const disabled = !!min && v < min;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => (onChange(v), setOpen(false))}
                className={cx(
                  'aspect-square rounded-lg text-[13px] transition disabled:cursor-not-allowed disabled:text-line',
                  selected ? 'bg-primary font-medium text-white' : 'text-navy hover:bg-ice',
                  !selected && v === today && 'ring-1 ring-primary ring-inset',
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between border-t border-divider pt-2">
          <button type="button" className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-soft" onClick={() => (onChange(today), setOpen(false))}>
            Hôm nay
          </button>
          <button type="button" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-soft" onClick={() => setOpen(false)}>
            Đóng
          </button>
        </div>
      </div>
    </Popover>
  );
}

// ---------------------------------------------------------------------
// TimePicker — cột giờ + cột phút (bước 5 phút) + vài mốc nhanh
// ---------------------------------------------------------------------
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const QUICK = ['08:00', '09:00', '12:00', '14:00', '17:00', '18:00'];

export function TimePicker({ value, onChange, placeholder = 'Chọn giờ' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value ? value.split(':') : ['', ''];
  const hourRef = useRef<HTMLDivElement>(null);

  // Mở ra thì cuộn tới giờ đang chọn
  useEffect(() => {
    if (open && h) hourRef.current?.querySelector(`[data-h="${h}"]`)?.scrollIntoView({ block: 'center' });
  }, [open, h]);

  const col = 'flex max-h-48 flex-col gap-1 overflow-y-auto pr-1';
  const cell = (on: boolean) =>
    cx('rounded-lg px-3 py-1.5 text-[13px] transition', on ? 'bg-primary font-medium text-white' : 'text-navy hover:bg-ice');

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={220}
      trigger={
        <FieldButton open={open} onClick={() => setOpen(!open)} placeholder={placeholder} icon={<Clock className="size-4 shrink-0 text-primary" />}>
          {value || undefined}
        </FieldButton>
      }
    >
      <div className="flex flex-col gap-2 p-1">
        <div className="flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => (onChange(q), setOpen(false))}
              className={cx('rounded-full border px-2 py-0.5 text-[11px]', q === value ? 'border-primary bg-primary text-white' : 'border-line text-primary hover:bg-soft')}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-divider pt-2">
          <div>
            <p className="mb-1 text-center text-[10px] uppercase text-muted">Giờ</p>
            <div ref={hourRef} className={col}>
              {HOURS.map((x) => (
                <button key={x} data-h={x} type="button" className={cell(x === h)} onClick={() => onChange(`${x}:${m || '00'}`)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-center text-[10px] uppercase text-muted">Phút</p>
            <div className={col}>
              {MINUTES.map((x) => (
                <button key={x} type="button" className={cell(x === m)} onClick={() => (onChange(`${h || '09'}:${x}`), setOpen(false))}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Popover>
  );
}

// ---------------------------------------------------------------------
// MemberPicker — chọn nhiều thành viên (dùng cho "BTT phụ trách")
// ---------------------------------------------------------------------
export function MemberPicker({
  people,
  value,
  onChange,
  placeholder = 'Thêm thành viên',
}: {
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
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  return (
    <Popover
      open={open}
      onClose={() => (setOpen(false), setQ(''))}
      trigger={
        <div
          className={cx(
            'flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition',
            open ? 'border-primary bg-white ring-2 ring-primary/20' : 'border-line bg-ice',
          )}
        >
          {selected.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pl-0.5 pr-2 text-xs text-navy">
              <span className="flex size-6 items-center justify-center rounded-full bg-ice text-[10px] font-medium">{initials(p.fullName)}</span>
              {p.fullName}
              <button type="button" onClick={() => toggle(p.id)} aria-label={`Bỏ ${p.fullName}`} className="text-primary hover:text-navy">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-primary hover:bg-white"
          >
            <Plus className="size-3.5" /> {selected.length ? 'Thêm' : placeholder}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên..."
            className="w-full rounded-lg border border-line bg-soft py-2 pl-8 pr-2 text-[13px] text-navy outline-none focus:border-primary"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto">
          {filtered.map((p) => {
            const on = value.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-soft', on && 'bg-soft')}
                >
                  <span className={cx('flex size-[18px] items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-line bg-white')}>
                    {on && <Check className="size-3 text-white" />}
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-ice text-[10px] font-medium text-navy">{initials(p.fullName)}</span>
                  <span className="flex-1">
                    <span className="block text-[13px] text-navy">{p.fullName}</span>
                    {p.username && <span className="block text-[11px] text-muted">@{p.username}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="px-2 py-4 text-center text-xs text-muted">Không tìm thấy</li>}
        </ul>
      </div>
    </Popover>
  );
}
