'use client';
// Giao diện bật thông báo trên thiết bị:
//  * <PushBanner>       : dải nhắc ở đầu mọi trang (ẩn được), hướng dẫn cài lên iPhone / bật thông báo
//  * <PushSettingsCard> : thẻ đầy đủ ở trang Thông báo (bật / tắt / gửi thử)
import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, Send, Share, SquarePlus, X } from 'lucide-react';
import { Button, cx } from './ui';
import { disablePush, enablePush, getPushState, isIOS, sendTestPush, type PushState } from '@/lib/webpush';

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = useCallback(() => {
    getPushState()
      .then(setState)
      .catch(() => setState('unsupported'));
  }, []);
  useEffect(refresh, [refresh]);
  return { state, setState, refresh };
}

/** Hướng dẫn "Thêm vào màn hình chính" trên iPhone */
function IosInstallSteps() {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed text-navy">
      <li>
        <b>1.</b> Mở trang này bằng <b>Safari</b>, bấm nút <Share className="mx-0.5 inline size-4 align-[-3px] text-primary" /> <b>Chia sẻ</b>
      </li>
      <li>
        <b>2.</b> Chọn <SquarePlus className="mx-0.5 inline size-4 align-[-3px] text-primary" /> <b>Thêm vào MH chính</b> → <b>Thêm</b>
      </li>
      <li>
        <b>3.</b> Mở <b>CSE Task</b> từ icon mới trên màn hình chính, đăng nhập và bấm <b>Bật thông báo</b>
      </li>
    </ol>
  );
}

const DISMISS_KEY = 'cse_push_banner_hidden_until';

export function PushBanner() {
  const { state, setState } = usePushState();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      setHidden(Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now());
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || !state || !['ios-install', 'off'].includes(state)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 3600 * 1000)); // ẩn 7 ngày
    } catch {}
    setHidden(true);
  };

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      setState(await enablePush());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-white p-4">
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex-1">
        {state === 'ios-install' ? (
          <>
            <p className="text-sm font-medium text-navy">Cài CSE Task lên iPhone để nhận thông báo</p>
            <p className="text-xs text-muted">iPhone chỉ cho web gửi thông báo khi đã được thêm vào màn hình chính.</p>
            <IosInstallSteps />
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-navy">Bật thông báo trên thiết bị này</p>
            <p className="text-xs text-muted">Nhận bản tin việc cần làm lúc 09:00 mỗi sáng và nhắc việc từ BCH.</p>
            <Button size="sm" className="mt-3" onClick={enable} loading={busy} icon={<BellRing className="size-4" />}>
              Bật thông báo
            </Button>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          </>
        )}
      </div>
      <button onClick={dismiss} aria-label="Ẩn" className="text-primary hover:text-navy">
        <X className="size-4" />
      </button>
    </div>
  );
}

const STATE_TEXT: Record<PushState, string> = {
  on: 'Đang bật trên thiết bị này',
  off: 'Chưa bật trên thiết bị này',
  denied: 'Đã bị chặn',
  'ios-install': 'Cần cài lên màn hình chính',
  unsupported: 'Trình duyệt này không hỗ trợ',
  'server-off': 'Máy chủ chưa bật Web Push',
};

export function PushSettingsCard() {
  const { state, setState, refresh } = usePushState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {state === 'on' ? <BellRing className="size-5 text-primary" /> : <BellOff className="size-5 text-muted" />}
          <div>
            <p className="text-sm font-medium text-navy">Thông báo trên điện thoại / trình duyệt</p>
            <p className={cx('text-xs', state === 'on' ? 'text-primary' : 'text-muted')}>{STATE_TEXT[state]}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === 'off' && (
            <Button size="sm" loading={busy} icon={<BellRing className="size-4" />} onClick={() => run(async () => setState(await enablePush()))}>
              Bật thông báo
            </Button>
          )}
          {state === 'on' && (
            <>
              <Button
                size="sm"
                variant="outline"
                loading={busy}
                icon={<Send className="size-4" />}
                onClick={() =>
                  run(async () => {
                    const r = await sendTestPush();
                    setMsg({ ok: r.sent > 0, text: r.sent > 0 ? `Đã gửi thử tới ${r.sent} thiết bị. Kiểm tra màn hình khoá nhé!` : 'Chưa gửi được, thử bật lại thông báo.' });
                  })
                }
              >
                Gửi thử
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => (await disablePush(), refresh()))}>
                Tắt
              </Button>
            </>
          )}
        </div>
      </div>
      {state === 'ios-install' && <IosInstallSteps />}
      {state === 'denied' && (
        <p className="text-[13px] text-navy">
          Bạn đã chặn thông báo. {isIOS() ? 'Vào Cài đặt → Thông báo → CSE Task → bật "Cho phép thông báo".' : 'Bấm biểu tượng ổ khoá cạnh thanh địa chỉ → Thông báo → Cho phép.'}{' '}
          Sau đó tải lại trang.
        </p>
      )}
      {state === 'server-off' && <p className="text-[13px] text-muted">Quản trị viên cần đặt VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY cho API (xem DEPLOY.md).</p>}
      {msg && <p className={cx('text-[13px]', msg.ok ? 'text-primary' : 'text-danger')}>{msg.text}</p>}
      <p className="text-[11px] text-muted">Mỗi thiết bị (iPhone, máy tính…) cần bật riêng một lần.</p>
    </section>
  );
}
