'use client';
// Đăng ký (Figma: "Sign up"). Chỉ được chọn 1 trong 2 vai trò: BCH hoặc BTT.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { AuthLayout, PasswordInput } from '@/components/AuthLayout';
import { Alert, Button, Field, cx } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

type RegRole = 'BCH' | 'BTT';
const ROLES: { value: RegRole; title: string; desc: string }[] = [
  { value: 'BCH', title: 'BCH', desc: 'Ban Chấp hành' },
  { value: 'BTT', title: 'BTT', desc: 'Ban Truyền thông' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [role, setRole] = useState<RegRole | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setErrors({});
    // Kiểm tra nhanh phía trình duyệt; API vẫn kiểm tra lại (không bao giờ tin client)
    if (!role) return setErrors({ role: 'Vui lòng chọn vai trò' });
    if (form.password !== form.confirmPassword) return setErrors({ confirmPassword: 'Mật khẩu nhập lại không khớp' });
    setLoading(true);
    try {
      const user = await register({ ...form, role });
      router.replace(homeOf(user.role));
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.details) setErrors(Object.fromEntries(e2.details.map((d) => [d.field, d.message])));
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Bắt đầu nào" title="Tạo tài khoản" subtitle="Sự kiện tuyệt vời tiếp theo bắt đầu từ đây.">
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-[18px]">
          <Field label="Họ và tên *" error={errors.fullName}>
            <input className="input" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
          </Field>
          <Field label="Username *" hint="Dùng username duy nhất cho hồ sơ của bạn." error={errors.username}>
            <input className="input" value={form.username} onChange={set('username')} autoComplete="username" />
          </Field>
          <Field label="Email *" error={errors.email}>
            <div className="relative">
              <input className="input pr-10" type="email" value={form.email} onChange={set('email')}  autoComplete="email" />
              <Mail className="absolute right-3 top-1/2 size-[18px] -translate-y-1/2 text-primary" />
            </div>
          </Field>
          <Field label="Mật khẩu *" hint="Tối thiểu 8 ký tự, có ít nhất 1 chữ số." error={errors.password}>
            <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Nhập lại mật khẩu *" error={errors.confirmPassword}>
            <PasswordInput value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
          </Field>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="label">Chọn vai trò *</span>
          <div className="flex gap-3" role="radiogroup">
            {ROLES.map((r) => {
              const selected = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRole(r.value)}
                  className={cx(
                    'flex flex-1 items-center gap-2.5 rounded-lg p-3.5 text-left transition',
                    selected ? 'border-2 border-primary bg-ice' : 'border border-line bg-white hover:bg-soft',
                  )}
                >
                  <span
                    className={cx(
                      'flex size-[18px] shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary' : 'border-line bg-white',
                    )}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[13px] text-navy">{r.title}</span>
                    <span className="block text-[10px] text-muted">{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <span className={cx('text-[11px]', errors.role ? 'text-danger' : 'text-muted')}>
            {errors.role ?? 'Vai trò quyết định không gian làm việc của bạn.'}
          </span>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" loading={loading} icon={<ArrowRight className="size-[17px]" />}>
          Đăng ký
        </Button>
        <p className="text-center text-[13px] text-muted">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-bold text-primary">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
