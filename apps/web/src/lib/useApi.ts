'use client';
// Hook lấy dữ liệu: const { data, error, loading, reload } = useApi<T>('/events')
//
// Có BỘ NHỚ ĐỆM (cache) theo đường dẫn — kiểu "stale-while-revalidate":
//  * Quay lại một trang đã mở: hiện NGAY dữ liệu cũ (không nháy "Đang tải..."),
//    đồng thời âm thầm tải bản mới rồi cập nhật.
//  * Nhờ vậy chuyển qua lại giữa các tab điều hướng mượt, không bị "khựng".
// (Dự án lớn hơn có thể dùng thư viện SWR hoặc TanStack Query làm việc này.)
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

const cache = new Map<string, unknown>();

/** Xoá cache (VD khi đăng xuất) */
export const clearApiCache = () => cache.clear();

export function useApi<T>(path: string | null, options: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(() => (path ? ((cache.get(path) as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path && !cache.has(path));
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent && !cache.has(path)) setLoading(true);
      try {
        const res = await api<T>(path);
        cache.set(path, res);
        // Bỏ kết quả cũ nếu path đã đổi trong lúc chờ (VD gõ ô tìm kiếm nhanh)
        if (latest.current === path) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (latest.current === path) setError((e as Error).message);
      } finally {
        if (latest.current === path) setLoading(false);
      }
    },
    [path],
  );

  // Đổi path: lấy ngay dữ liệu đệm (nếu có) rồi tải lại
  useEffect(() => {
    if (path && cache.has(path)) {
      setData(cache.get(path) as T);
      setLoading(false);
    }
    void load();
  }, [load, path]);

  useEffect(() => {
    if (!options.pollMs) return;
    const id = setInterval(() => void load(true), options.pollMs);
    return () => clearInterval(id);
  }, [load, options.pollMs]);

  const reload = useCallback(() => load(true), [load]);
  return { data, error, loading, reload, setData };
}

/** Trì hoãn giá trị (dùng cho ô tìm kiếm để không gọi API mỗi lần gõ phím) */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
