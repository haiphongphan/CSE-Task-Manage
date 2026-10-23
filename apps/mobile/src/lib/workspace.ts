// =====================================================================
// "Không gian làm việc" của mỗi vai trò = MỘT màn hình (/home) chứa nhiều tab.
// Đổi tab chỉ đổi biến trạng thái, các tab đã mở vẫn được giữ trong bộ nhớ,
// nên chuyển qua lại tức thì, không tải lại như khi mở một màn mới.
//
// Biến `current` nằm ngoài React (module-level) để chỗ nào cũng gọi được
// openTab('btt/reminders'), kể cả khi bấm vào thông báo đẩy.
// =====================================================================
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Role } from './types';

export type TabKey = 'admin/accounts' | 'admin/tasks' | 'bch/new' | 'bch/events' | 'btt/events' | 'btt/reminders';

export const TABS: Record<Role, { key: TabKey; label: string }[]> = {
  ADMIN: [
    { key: 'admin/accounts', label: 'Tài khoản' },
    { key: 'admin/tasks', label: 'Quản lý task' },
  ],
  BCH: [
    { key: 'bch/new', label: 'Tạo sự kiện' },
    { key: 'bch/events', label: 'Sự kiện của tôi' },
  ],
  BTT: [
    { key: 'btt/events', label: 'Không gian làm việc' },
    { key: 'btt/reminders', label: 'Nhắc nhở thông minh' },
  ],
};

/** Tab mở mặc định khi đăng nhập */
export const DEFAULT_TAB: Record<Role, TabKey> = { ADMIN: 'admin/accounts', BCH: 'bch/events', BTT: 'btt/events' };

let current: TabKey | null = null;
const listeners = new Set<() => void>();

export function setTab(tab: TabKey) {
  current = tab;
  listeners.forEach((l) => l());
}

/** Chuyển tới một tab từ bất kỳ đâu (kể cả từ màn chi tiết): quay về /home rồi mở tab đó */
export function openTab(tab: TabKey) {
  setTab(tab);
  router.navigate('/home');
}

export function useCurrentTab(role: Role): TabKey {
  const tab = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => current,
  );
  // Tab không thuộc vai trò hiện tại (VD vừa đăng xuất rồi đăng nhập vai trò khác) -> về mặc định
  return tab && TABS[role].some((t) => t.key === tab) ? tab : DEFAULT_TAB[role];
}

/** Mỗi tab biết mình có đang hiện hay không + "tick" tăng mỗi khi màn /home được quay lại */
export const TabActiveContext = createContext({ active: true, focusTick: 0 });

/**
 * Gọi `callback` mỗi khi tab này được mở lại hoặc quay về từ màn chi tiết
 * (dùng để tải lại dữ liệu ngầm — dữ liệu cũ vẫn hiện ngay, không nháy "đang tải").
 * Bỏ qua lần đầu vì lúc đó useApi đã tự tải.
 */
export function useOnTabActive(callback: () => void) {
  const { active, focusTick } = useContext(TabActiveContext);
  const first = useRef(true);
  const cb = useRef(callback);
  cb.current = callback;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active) cb.current();
  }, [active, focusTick]);
}
