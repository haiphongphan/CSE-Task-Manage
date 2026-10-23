'use client';
// Đăng nhập — Figma chưa có màn này, dựng theo cùng phong cách với trang Đăng ký.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { AuthLayout, PasswordInput } from '@/components/AuthLayout';
import { Alert, Button, Field } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Đã đăng nhập rồi thì vào thẳng trang chủ
  useEffect(() => {
    if (!authLoading && user) router.replace(user.mustChangePassword ? '/change-password' : homeOf(user.role));
  }, [authLoading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginId, password); // useEffect phía trên sẽ chuyển trang
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="Chào mừng trở lại" title="Đăng nhập" subtitle="Tiếp tục quản lý sự kiện của bạn.">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-[18px]">
          <Field label="Username hoặc email *">
            <input className="input" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Mật khẩu *">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={loading} icon={<ArrowRight className="size-[17px]" />}>
          Đăng nhập
        </Button>
        <p className="text-center text-[13px] text-muted">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="font-bold text-primary">
            Đăng ký
          </Link>
        </p>
        <Alert>
          <b>Tài khoản demo</b> (mật khẩu <code>matkhau123</code>): <code>linh.nguyen</code> (Admin) · <code>mai.anh</code> (BCH) ·{' '}
          <code>minh.tran</code> (BTT)
        </Alert>
      </form>
    </AuthLayout>
  );
}
