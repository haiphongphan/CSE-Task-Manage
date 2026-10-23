'use client';
// Bố cục trang Đăng ký / Đăng nhập (Figma: "Sign up · Desktop")
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff, Layers2, ShieldCheck } from 'lucide-react';

export function AuthLayout({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-4 py-12 sm:py-16">
      <div className="flex items-center gap-2.5">
        <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-primary text-white">
          <Layers2 className="size-[21px]" />
        </span>
        <span className="text-lg font-bold text-navy">CSE Task Manage</span>
      </div>
      <div className="flex w-full max-w-[420px] flex-col gap-6 py-11">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-[32px] font-bold leading-tight text-navy sm:text-[36px]">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {children}
        <div className="h-px bg-divider" />
        <p className="flex items-center justify-center gap-2 text-[11px] text-muted">
          <ShieldCheck className="size-4 text-primary" /> Không gian làm việc an toàn, phân quyền theo vai trò.
        </p>
      </div>
    </div>
  );
}

/** Ô mật khẩu có nút ẩn/hiện */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className="input pr-10" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary"
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        {show ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
      </button>
    </div>
  );
}
