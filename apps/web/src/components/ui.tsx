'use client';
// Bộ component giao diện dùng chung, tạo hình theo Figma.
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { initials } from '@/lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------- Button ----------------
type Variant = 'primary' | 'outline' | 'ghost' | 'navy' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white border-primary hover:bg-primary-dark',
  outline: 'bg-white text-primary border-line hover:bg-soft',
  ghost: 'bg-transparent text-primary border-transparent hover:bg-soft',
  navy: 'bg-navy text-white border-navy hover:opacity-90',
  danger: 'bg-white text-danger border-danger/40 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-normal transition disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'min-h-[44px] px-[18px] text-sm' : 'min-h-[34px] px-3 text-[13px]',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------- Form field ----------------
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-[7px]', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="text-[11px] text-danger">{error}</span> : hint && <span className="hint">{hint}</span>}
    </label>
  );
}

// ---------------- Badge ----------------
type Tone = 'ice' | 'navy' | 'outline' | 'danger' | 'success';
const tones: Record<Tone, string> = {
  ice: 'bg-ice text-navy',
  navy: 'bg-navy text-white',
  outline: 'bg-white text-navy border border-line',
  danger: 'bg-red-100 text-danger',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
export function Badge({ tone = 'ice', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-none', tones[tone], className)}>
      {children}
    </span>
  );
}

// ---------------- Thẻ thống kê ----------------
export function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-start justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-[28px] font-bold leading-none text-navy">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

// ---------------- Thanh tiến độ ----------------
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ice', className)}>
      <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ---------------- Avatar chữ cái ----------------
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-ice text-[11px] font-medium text-navy', className)}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

// ---------------- Công tắc ----------------
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-line')}
    >
      <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
    </button>
  );
}

// ---------------- Nhóm nút lọc (chip) ----------------
export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[38px] rounded-lg border px-4 text-[13px] transition',
            o.value === value ? 'border-primary bg-primary text-white' : 'border-line bg-white text-primary hover:bg-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Hộp thoại (modal) ----------------
export function Modal({
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/30 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="my-8 w-full max-w-[560px] rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-divider pb-5">
          <div>
            <h2 className="text-2xl text-navy">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Đóng" className="text-primary hover:opacity-70">
            <X className="size-5" />
          </button>
        </div>
        <div className="py-5">{children}</div>
        {footer && <div className="border-t border-divider pt-5">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Tiêu đề trang ----------------
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  meta,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{eyebrow}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">{meta}</div>}
    </div>
  );
}

// ---------------- Trạng thái tải / lỗi / rỗng ----------------
export function Loading({ text = 'Đang tải...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" /> {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center text-sm text-danger">
      {message}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-12 text-center text-sm text-muted">{children}</div>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-line bg-soft text-navy',
    error: 'border-red-200 bg-red-50 text-danger',
    success: 'border-line bg-white text-navy',
  };
  return <div className={cx('rounded-xl border px-4 py-3 text-[13px]', styles[tone])}>{children}</div>;
}
