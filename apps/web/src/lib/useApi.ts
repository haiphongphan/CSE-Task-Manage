'use client';
// Hook lấy dữ liệu đơn giản: const { data, error, loading, reload } = useApi<T>('/events')
// (Dự án lớn hơn có thể thay bằng SWR hoặc TanStack Query.)
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useApi<T>(path: string | null, options: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent) setLoading(true);
      try {
        const res = await api<T>(path);
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

  useEffect(() => {
    void load();
  }, [load]);

  // Tuỳ chọn: tự tải lại định kỳ (dùng cho chuông thông báo)
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
