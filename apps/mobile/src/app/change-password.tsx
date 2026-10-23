// Đổi mật khẩu (bắt buộc nếu Admin vừa tạo tài khoản với mật khẩu tạm)
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { Alert, Button, Field, Input } from '@/components/ui';
import { homeOf, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function ChangePasswordScreen() {
  const { user, refresh } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!user) return <Redirect href="/login" />;

  const submit = async () => {
    setError('');
    if (next !== confirm) return setError('Mật khẩu nhập lại không khớp');
    setLoading(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: next } });
      await refresh();
      router.replace(homeOf(user.role) as never);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      eyebrow="Bảo mật tài khoản"
      title="Đổi mật khẩu"
      subtitle={user.mustChangePassword ? 'Bạn đang dùng mật khẩu tạm, hãy đặt mật khẩu mới để tiếp tục.' : 'Cập nhật mật khẩu đăng nhập.'}
    >
      <View style={{ gap: 18 }}>
        <Field label="Mật khẩu hiện tại *">
          <Input value={cur} onChangeText={setCur} secure />
        </Field>
        <Field label="Mật khẩu mới *" hint="Tối thiểu 8 ký tự, có ít nhất 1 chữ số.">
          <Input value={next} onChangeText={setNext} secure />
        </Field>
        <Field label="Nhập lại mật khẩu mới *">
          <Input value={confirm} onChangeText={setConfirm} secure />
        </Field>
      </View>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button title="Lưu mật khẩu mới" icon="check" onPress={submit} loading={loading} />
      {!user.mustChangePassword && <Button title="Quay lại" variant="outline" onPress={() => router.back()} />}
    </AuthScreen>
  );
}
