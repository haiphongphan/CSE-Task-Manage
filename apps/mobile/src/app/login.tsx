// Đăng nhập
import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { Alert, Button, Field, Input, T } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Redirect href={(user.mustChangePassword ? '/change-password' : homeOf(user.role)) as never} />;

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(loginId.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen eyebrow="Chào mừng trở lại" title="Đăng nhập" subtitle="Tiếp tục quản lý sự kiện của bạn.">
      <View style={{ gap: 18 }}>
        <Field label="Username hoặc email *">
          <Input value={loginId} onChangeText={setLoginId} autoComplete="username" placeholder="minh.tran" />
        </Field>
        <Field label="Mật khẩu *">
          <Input value={password} onChangeText={setPassword} secure onSubmitEditing={submit} />
        </Field>
      </View>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button title="Đăng nhập" icon="arrow-right" onPress={submit} loading={loading} />
      <T style={{ textAlign: 'center' }} color={colors.muted}>
        Chưa có tài khoản?{' '}
        <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>
          Đăng ký
        </Link>
      </T>
      <Alert>Tài khoản demo (mật khẩu matkhau123): linh.nguyen (Admin) · mai.anh (BCH) · minh.tran (BTT)</Alert>
    </AuthScreen>
  );
}
