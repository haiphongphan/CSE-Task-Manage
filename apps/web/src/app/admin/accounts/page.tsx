'use client';
// Admin · Quản lý tài khoản (Figma: "Admin account management", "Create account", "Edit account role")
import { useState } from 'react';
import { CheckCircle2, Mail, PenSquare, Plus, Search, ShieldCheck, Users, UserCog } from 'lucide-react';
import { Alert, Avatar, Badge, Button, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, cx } from '@/components/ui';
import { PasswordInput } from '@/components/AuthLayout';
import { api, qs, type ApiError } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/useApi';
import { fmtDate, ROLE_DESC } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { Role, User } from '@/lib/types';

interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; admin: number; bch: number; btt: number };
}

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<UsersResponse>(`/users${qs({ search: q, role, page, pageSize: 8 })}`);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [flash, setFlash] = useState('');

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Quản trị / Thành viên"
        title="Quản lý tài khoản"
        description="Đúng quyền truy cập cho từng thành viên trong đội."
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Thêm tài khoản
          </Button>
        }
      />

      {flash && (
        <Alert tone="success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" /> {flash}
          </span>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng tài khoản" value={data?.stats.total ?? '–'} sub={`Gồm ${data?.stats.admin ?? 0} Admin`} icon={<Users className="size-[18px]" />} />
        <StatCard label="Ban Chấp hành" value={data?.stats.bch ?? '–'} sub="Vai trò BCH · tạo sự kiện" icon={<UserCog className="size-[18px]" />} />
        <StatCard label="Ban Truyền thông" value={data?.stats.btt ?? '–'} sub="Vai trò BTT · nhận task media" icon={<ShieldCheck className="size-[18px]" />} />
      </div>

      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
            <input
              className="input !bg-soft pl-9"
              placeholder="Tìm theo tên, username hoặc email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="input !bg-white sm:w-44"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">Admin</option>
            <option value="BCH">BCH</option>
            <option value="BTT">BTT</option>
          </select>
        </div>

        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="bg-soft text-[11px] uppercase text-navy">
                  <th className="px-3 py-3 font-normal">Họ tên / Username</th>
                  <th className="px-3 py-3 font-normal">Email</th>
                  <th className="px-3 py-3 font-normal">Vai trò</th>
                  <th className="px-3 py-3 font-normal">Ngày tạo</th>
                  <th className="px-3 py-3 font-normal">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-divider last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} size={30} />
                        <div>
                          <p className="text-navy">{u.fullName}</p>
                          <p className="text-[11px] text-muted">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{u.email}</td>
                    <td className="px-3 py-3">
                      <Badge tone={u.role === 'ADMIN' ? 'navy' : 'ice'}>{u.role}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted">{u.createdAt ? fmtDate(u.createdAt) : '–'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => setEditing(u)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                        <PenSquare className="size-4" /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.items.length === 0 && <p className="py-10 text-center text-sm text-muted">Không tìm thấy tài khoản phù hợp</p>}
          </div>
        )}

        {data && (
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted sm:flex-row">
            <span>
              Hiển thị {data.total ? (page - 1) * data.pageSize + 1 : 0}–{Math.min(page * data.pageSize, data.total)} / {data.total} tài khoản
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Trước
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={cx('size-[34px] rounded-lg border text-[13px]', n === page ? 'border-primary bg-primary text-white' : 'border-line bg-white text-primary')}
                >
                  {n}
                </button>
              ))}
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 text-primary" /> Admin quản lý quyền truy cập. BCH tạo sự kiện. BTT nhận và thực hiện task media.
      </p>

      {editing && (
        <AccountModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setFlash(msg);
            void reload();
          }}
        />
      )}
    </div>
  );
}

const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Admin quản lý được mọi tài khoản, sự kiện và task.',
  BCH: 'BCH tạo sự kiện và phân công task cho BTT.',
  BTT: 'BTT nhận task media và nhắc nhở hạn chót.',
};

function AccountModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: (msg: string) => void }) {
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
  const set = (k: 'fullName' | 'username' | 'email' | 'password') => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError('');
    setErrors({});
    try {
      if (isNew) {
        await api('/users', { method: 'POST', body: form });
        onSaved(`Đã tạo tài khoản ${form.fullName}.`);
      } else {
        const { sendEmail: _ignored, password, ...rest } = form;
        await api(`/users/${user.id}`, { method: 'PATCH', body: { ...rest, ...(password && { password }) } });
        onSaved(`Đã cập nhật tài khoản ${form.fullName}.`);
      }
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.details) setErrors(Object.fromEntries(e2.details.map((d) => [d.field, d.message])));
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!user || !confirm(`Xoá tài khoản ${user.fullName}? Thao tác không thể hoàn tác.`)) return;
    try {
      await api(`/users/${user.id}`, { method: 'DELETE' });
      onSaved(`Đã xoá tài khoản ${user.fullName}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const roleChanged = !isNew && form.role !== user.role;

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Tạo tài khoản mới' : 'Sửa tài khoản'}
      subtitle={isNew ? 'Mời thành viên mới vào CSE Task Manage.' : `Cập nhật quyền truy cập cho ${user.fullName}.`}
      footer={
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={save} loading={saving}>
              {isNew ? 'Tạo tài khoản' : 'Lưu thay đổi'}
            </Button>
          </div>
          {!isNew && user.id !== me?.id && (
            <button onClick={remove} className="text-xs text-danger hover:underline">
              Xoá tài khoản này
            </button>
          )}
          <p className="text-[11px] text-muted">* Bắt buộc · Chỉ Admin được quản lý vai trò tài khoản.</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên *" error={errors.fullName}>
            <input className="input" value={form.fullName} onChange={set('fullName')} />
          </Field>
          <Field label="Username *" error={errors.username}>
            <input className="input" value={form.username} onChange={set('username')} />
          </Field>
        </div>
        <Field label="Email *" error={errors.email}>
          <div className="relative">
            <input className="input pr-10" type="email" value={form.email} onChange={set('email')} />
            <Mail className="absolute right-3 top-1/2 size-[18px] -translate-y-1/2 text-primary" />
          </div>
        </Field>
        <Field
          label={isNew ? 'Mật khẩu tạm *' : 'Đặt lại mật khẩu (tuỳ chọn)'}
          hint="Người dùng sẽ phải đổi mật khẩu này sau lần đăng nhập đầu."
          error={errors.password}
        >
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="label">Vai trò *</span>
          <div className="grid grid-cols-3 gap-3">
            {(['ADMIN', 'BCH', 'BTT'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, role: r })}
                className={cx(
                  'flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-[13px] text-navy',
                  form.role === r ? 'border-2 border-primary bg-ice' : 'border border-line bg-white hover:bg-soft',
                )}
              >
                {form.role === r && <CheckCircle2 className="size-4 text-primary" />}
                {r === 'ADMIN' ? 'Admin' : r}
              </button>
            ))}
          </div>
          <span className="hint">
            {roleChanged ? `${user.role} → ${form.role} · Vai trò mới có hiệu lực khi lưu.` : ROLE_HINT[form.role]}
          </span>
        </div>
        {roleChanged && (
          <div className="rounded-xl bg-soft p-4">
            <p className="text-[13px] text-navy">Quyền truy cập sẽ thay đổi</p>
            <p className="mt-1 text-xs text-muted">
              {form.fullName} sẽ trở thành {ROLE_DESC[form.role]}.{' '}
              {user.role === 'BTT' && 'Tài khoản sẽ được gỡ khỏi các sự kiện đang phụ trách. '}
              {user.role === 'BCH' && 'Các sự kiện đã tạo vẫn được giữ lại. '}
            </p>
          </div>
        )}
        {isNew && (
          <label className="flex items-center gap-2.5 text-[13px] text-navy">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              checked={form.sendEmail}
              onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
            />
            Gửi thông tin đăng nhập qua email
          </label>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
