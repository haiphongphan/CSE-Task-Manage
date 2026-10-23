'use client';
// Đổi mật khẩu — bắt buộc sau lần đăng nhập đầu với mật khẩu tạm do Admin tạo.
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { AuthLayout, PasswordInput } from '@/components/AuthLayout';
import { Alert, Button, Field, Loading } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function ChangePasswordPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (!user) return <Loading />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) return setError('Mật khẩu nhập lại không khớp');
    setLoading(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      await refresh();
      router.replace(homeOf(user!.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Bảo mật tài khoản"
      title="Đổi mật khẩu"
      subtitle={user.mustChangePassword ? 'Bạn đang dùng mật khẩu tạm, hãy đặt mật khẩu mới để tiếp tục.' : 'Cập nhật mật khẩu đăng nhập.'}
    >
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <Field label="Mật khẩu hiện tại *">
          <PasswordInput value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="Mật khẩu mới *" hint="Tối thiểu 8 ký tự, có ít nhất 1 chữ số.">
          <PasswordInput value={newPassword} onChange={(e) => setNew(e.target.value)} required />
        </Field>
        <Field label="Nhập lại mật khẩu mới *">
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={loading} icon={<Check className="size-4" />}>
          Lưu mật khẩu mới
        </Button>
        {!user.mustChangePassword && (
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Quay lại
          </Button>
        )}
      </form>
    </AuthLayout>
  );
}
