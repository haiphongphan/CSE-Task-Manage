// Đăng ký — chỉ chọn được BCH hoặc BTT
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { Alert, Button, Field, Input, T } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import type { ApiError } from '@/lib/api';

const ROLES = [
  { value: 'BCH', title: 'BCH', desc: 'Ban Chấp hành' },
  { value: 'BTT', title: 'BTT', desc: 'Ban Truyền thông' },
] as const;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [role, setRole] = useState<'BCH' | 'BTT' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setError('');
    setErrors({});
    if (!role) return setErrors({ role: 'Vui lòng chọn vai trò' });
    if (form.password !== form.confirmPassword) return setErrors({ confirmPassword: 'Mật khẩu nhập lại không khớp' });
    setLoading(true);
    try {
      const user = await register({ ...form, role });
      router.replace(homeOf(user.role) as never);
    } catch (e) {
      const err = e as ApiError;
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen eyebrow="Bắt đầu nào" title="Tạo tài khoản" subtitle="Sự kiện tuyệt vời tiếp theo bắt đầu từ đây.">
      <View style={{ gap: 18 }}>
        <Field label="Họ và tên *" error={errors.fullName}>
          <Input value={form.fullName} onChangeText={set('fullName')} autoCapitalize="words" />
        </Field>
        <Field label="Username *" hint="Dùng username duy nhất cho hồ sơ của bạn." error={errors.username}>
          <Input value={form.username} onChangeText={set('username')} />
        </Field>
        <Field label="Email *" error={errors.email}>
          <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" icon="mail" />
        </Field>
        <Field label="Mật khẩu *" hint="Tối thiểu 8 ký tự, có ít nhất 1 chữ số." error={errors.password}>
          <Input value={form.password} onChangeText={set('password')} secure />
        </Field>
        <Field label="Nhập lại mật khẩu *" error={errors.confirmPassword}>
          <Input value={form.confirmPassword} onChangeText={set('confirmPassword')} secure />
        </Field>
      </View>
      <View style={{ gap: 10 }}>
        <T size={12}>Chọn vai trò *</T>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {ROLES.map((r) => {
            const on = role === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => setRole(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 8,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.primary : colors.line,
                  backgroundColor: on ? colors.ice : colors.white,
                }}
              >
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.primary : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  {on && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />}
                </View>
                <View>
                  <T>{r.title}</T>
                  <T size={10} color={colors.muted}>
                    {r.desc}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
        <T size={11} color={errors.role ? colors.danger : colors.muted}>
          {errors.role ?? 'Vai trò quyết định không gian làm việc của bạn.'}
        </T>
      </View>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button title="Đăng ký" icon="arrow-right" onPress={submit} loading={loading} />
      <T style={{ textAlign: 'center' }} color={colors.muted}>
        Đã có tài khoản?{' '}
        <Link href="/login" style={{ color: colors.primary, fontWeight: '700' }}>
          Đăng nhập
        </Link>
      </T>
    </AuthScreen>
  );
}
