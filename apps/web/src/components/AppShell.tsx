'use client';
// Khung trang sau khi đăng nhập: thanh điều hướng theo vai trò + chuông thông báo.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, KeyRound, Layers2, LogOut } from 'lucide-react';
import { useAuth, useRequireRole } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { fmtDayTime } from '@/lib/format';
import type { AppNotification, Role } from '@/lib/types';
import { Avatar, Loading, cx } from './ui';

const NAV: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: '/admin/accounts', label: 'Quản lý tài khoản' },
    { href: '/admin/tasks', label: 'Quản lý task' },
  ],
  BCH: [
    { href: '/bch/events/new', label: 'Tạo sự kiện' },
    { href: '/bch/events', label: 'Sự kiện của tôi' },
  ],
  BTT: [
    { href: '/btt/events', label: 'Không gian làm việc' },
    { href: '/btt/reminders', label: 'Nhắc nhở thông minh' },
  ],
};

const WORKSPACE: Record<Role, string> = {
  ADMIN: 'Không gian Admin',
  BCH: 'Không gian BCH',
  BTT: 'Không gian BTT',
};

/** Link đang được chọn: khớp dài nhất (để /bch/events/new không làm sáng cả /bch/events) */
function activeHref(pathname: string, items: { href: string }[]) {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AppShell({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useRequireRole(...roles);
  const pathname = usePathname();
  if (!user) return <Loading />;

  const items = NAV[user.role];
  const active = activeHref(pathname, items);

  const navLinks = items.map((i) => (
    <Link
      key={i.href}
      href={i.href}
      className={cx(
        'flex min-h-10 flex-1 items-center justify-center rounded-lg px-4 text-[13px] transition sm:flex-none',
        i.href === active ? 'bg-primary text-white' : 'text-white/90 hover:bg-white/10',
      )}
    >
      {i.label}
    </Link>
  ));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:h-20 sm:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-primary">
              <Layers2 className="size-[21px]" />
            </span>
            <span className="text-[17px] font-bold">CSE Task Manage</span>
          </Link>
          <nav className="mx-auto hidden gap-2 md:flex">{navLinks}</nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <NotificationBell />
            <span className="hidden h-6 w-px bg-white/30 sm:block" />
            <span className="hidden text-xs text-white/80 sm:block">{WORKSPACE[user.role]}</span>
            <UserMenu />
          </div>
        </div>
        {/* Mobile: hàng tab bên dưới (giống Figma bản Mobile) */}
        <nav className="flex gap-2 px-3 pb-3 md:hidden">{navLinks}</nav>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-10 sm:py-10">{children}</main>
    </div>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOutside]);
  return ref;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Tài khoản">
        <Avatar name={user.fullName} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-60 overflow-hidden rounded-xl border border-line bg-white text-navy shadow-xl">
          <div className="border-b border-divider px-4 py-3">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted">
              @{user.username} · {user.role}
            </p>
          </div>
          <Link href="/change-password" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-soft">
            <KeyRound className="size-4 text-primary" /> Đổi mật khẩu
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-soft">
            <LogOut className="size-4 text-primary" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

/** Chuông thông báo: tự tải lại mỗi 30 giây */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const router = useRouter();
  const { data, reload } = useApi<{ items: AppNotification[]; unreadCount: number }>('/notifications?limit=8', {
    pollMs: 30_000,
  });

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    setOpen(false);
    void reload();
    if (n.eventId) router.push(`/events/${n.eventId}`);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1" aria-label="Thông báo">
        <Bell className="size-5" />
        {!!data?.unreadCount && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-sky px-1 text-[10px] font-bold text-navy">
            {data.unreadCount > 9 ? '9+' : data.unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white text-navy shadow-xl">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <span className="text-sm font-medium">Thông báo</span>
            <button
              className="text-xs text-primary"
              onClick={async () => {
                await api('/notifications/read-all', { method: 'POST' });
                void reload();
              }}
            >
              Đánh dấu đã đọc
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {data?.items.length ? (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cx('block w-full border-b border-divider px-4 py-3 text-left hover:bg-soft', !n.isRead && 'bg-soft')}
                >
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                  <p className="mt-1 text-[10px] text-primary">{fmtDayTime(n.createdAt)}</p>
                </button>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted">Chưa có thông báo</p>
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block py-3 text-center text-[13px] text-primary hover:bg-soft">
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
