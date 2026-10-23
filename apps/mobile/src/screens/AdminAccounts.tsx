// Admin · Quản lý tài khoản (Figma: "Admin account management · Mobile", "Create account", "Edit account role")
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Avatar, Badge, Button, Card, Chips, Divider, ErrorBox, Field, Icon, Input, Loading, PageHeader, Screen, StatCard, T } from '@/components/ui';
import { api, qs, type ApiError } from '@/lib/api';
import { useAuth, useRoleAllowed } from '@/lib/auth';
import { useOnTabActive } from '@/lib/workspace';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDate } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { Role, User } from '@/lib/types';

interface Resp {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; admin: number; bch: number; btt: number };
}

export default function AccountsScreen() {
  const ok = useRoleAllowed('ADMIN');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<Resp>(ok ? `/users${qs({ search: q, role, page, pageSize: 8 })}` : null);
  useOnTabActive(reload); // mở lại tab -> tải lại ngầm
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [flash, setFlash] = useState('');
  if (!ok) return <Loading />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Screen onRefresh={reload}>
      <PageHeader eyebrow="Quản trị / Thành viên" title="Quản lý tài khoản" description="Đúng quyền truy cập cho từng thành viên trong đội." />
      <Button title="Thêm tài khoản" icon="plus" onPress={() => setEditing('new')} style={{ alignSelf: 'flex-start' }} />
      {flash ? <Alert tone="success">✓ {flash}</Alert> : null}
      <StatCard label="Tổng tài khoản" value={data?.stats.total ?? '–'} sub={`Gồm ${data?.stats.admin ?? 0} Admin`} icon="users" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label="Ban Chấp hành" value={data?.stats.bch ?? '–'} icon="user-check" />
        <StatCard label="Ban Truyền thông" value={data?.stats.btt ?? '–'} icon="shield" />
      </View>

      <Card style={{ gap: 12 }}>
        <Input value={search} onChangeText={(v) => (setSearch(v), setPage(1))} placeholder="Tìm theo tên, username hoặc email" icon="search" />
        <Chips
          value={role}
          onChange={(v) => (setRole(v), setPage(1))}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'ADMIN', label: 'Admin' },
            { value: 'BCH', label: 'BCH' },
            { value: 'BTT', label: 'BTT' },
          ]}
        />
        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : (
          data?.items.map((u) => (
            <Pressable key={u.id} onPress={() => setEditing(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.divider }}>
              <Avatar name={u.fullName} size={36} />
              <View style={{ flex: 1 }}>
                <T>{u.fullName}</T>
                <T size={11} color={colors.muted}>
                  @{u.username} · {u.email}
                </T>
                <T size={10} color={colors.muted}>
                  Tạo ngày {u.createdAt ? fmtDate(u.createdAt) : '–'}
                </T>
              </View>
              <Badge tone={u.role === 'ADMIN' ? 'navy' : 'ice'}>{u.role}</Badge>
              <Icon name="edit-2" size={14} />
            </Pressable>
          ))
        )}
        {data && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={11} color={colors.muted}>
              Trang {page}/{pages} · {data.total} tài khoản
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="outline" title="Trước" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Button small variant="outline" title="Sau" disabled={page >= pages} onPress={() => setPage(page + 1)} />
            </View>
          </View>
        )}
      </Card>

      {editing && (
        <AccountModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            setFlash(m);
            void reload();
          }}
        />
      )}
    </Screen>
  );
}

const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Admin quản lý được mọi tài khoản, sự kiện và task.',
  BCH: 'BCH tạo sự kiện và phân công task cho BTT.',
  BTT: 'BTT nhận task media và nhắc nhở hạn chót.',
};

function AccountModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: (m: string) => void }) {
  const { user: me } = useAuth();
  const isNew = !user;
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    password: '',
    role: (user?.role ?? 'BTT') as Role,
    sendEmail: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: 'fullName' | 'username' | 'email' | 'password') => (v: string) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    setError('');
    setErrors({});
    try {
      if (isNew) {
        await api('/users', { method: 'POST', body: form });
        onSaved(`Đã tạo tài khoản ${form.fullName}.`);
      } else {
        const { sendEmail: _s, password, ...rest } = form;
        await api(`/users/${user.id}`, { method: 'PATCH', body: { ...rest, ...(password && { password }) } });
        onSaved(`Đã cập nhật tài khoản ${form.fullName}.`);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/users/${user!.id}`, { method: 'DELETE' });
      onSaved(`Đã xoá tài khoản ${user!.fullName}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T size={22}>{isNew ? 'Tạo tài khoản mới' : 'Sửa tài khoản'}</T>
                <T size={12} color={colors.muted}>
                  {isNew ? 'Mời thành viên mới vào CSE Task Manage.' : `Cập nhật quyền truy cập cho ${user.fullName}.`}
                </T>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Đóng">
                <Icon name="x" size={20} />
              </Pressable>
            </View>
            <Divider />
            <Field label="Họ và tên *" error={errors.fullName}>
              <Input value={form.fullName} onChangeText={set('fullName')} autoCapitalize="words" />
            </Field>
            <Field label="Username *" error={errors.username}>
              <Input value={form.username} onChangeText={set('username')} />
            </Field>
            <Field label="Email *" error={errors.email}>
              <Input value={form.email} onChangeText={set('email')} icon="mail" keyboardType="email-address" />
            </Field>
            <Field label={isNew ? 'Mật khẩu tạm *' : 'Đặt lại mật khẩu (tuỳ chọn)'} hint="Người dùng sẽ phải đổi sau lần đăng nhập đầu." error={errors.password}>
              <Input value={form.password} onChangeText={set('password')} secure />
            </Field>
            <View style={{ gap: 8 }}>
              <T size={12}>Vai trò *</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['ADMIN', 'BCH', 'BTT'] as Role[]).map((r) => {
                  const on = form.role === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setForm({ ...form, role: r })}
                      style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.ice : colors.white }}
                    >
                      {on && <Icon name="check-circle" size={14} />}
                      <T>{r === 'ADMIN' ? 'Admin' : r}</T>
                    </Pressable>
                  );
                })}
              </View>
              <T size={11} color={colors.muted}>
                {!isNew && form.role !== user.role ? `${user.role} → ${form.role} · Vai trò mới có hiệu lực khi lưu.` : ROLE_HINT[form.role]}
              </T>
            </View>
            {isNew && (
              <Pressable onPress={() => setForm({ ...form, sendEmail: !form.sendEmail })} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Icon name={form.sendEmail ? 'check-square' : 'square'} />
                <T>Gửi thông tin đăng nhập qua email</T>
              </Pressable>
            )}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Divider />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Huỷ" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isNew ? 'Tạo tài khoản' : 'Lưu thay đổi'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
            {!isNew && user.id !== me?.id && <Button title="Xoá tài khoản này" variant="danger" icon="trash-2" onPress={remove} />}
            <T size={11} color={colors.muted}>
              * Bắt buộc · Chỉ Admin được quản lý vai trò tài khoản.
            </T>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
