// Gọi API từ app mobile (giống bản web, nhưng token lưu trong SecureStore)
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * Địa chỉ API:
 *  1. EXPO_PUBLIC_API_URL trong .env nếu có
 *  2. Nếu không: lấy IP của máy tính đang chạy `expo start` (hostUri) + cổng 4000.
 *     Nhờ vậy điện thoại thật cùng Wi-Fi gọi được API mà không cần cấu hình.
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web') return 'http://localhost:4000/api';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000/api`;
}

export const API_URL = resolveApiUrl();
const TOKEN_KEY = 'cse_token';

let cachedToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const tokenStore = {
  async load() {
    cachedToken = await storage.get(TOKEN_KEY);
    return cachedToken;
  },
  async set(token: string) {
    cachedToken = token;
    await storage.set(TOKEN_KEY, token);
  },
  async clear() {
    cachedToken = null;
    await storage.remove(TOKEN_KEY);
  },
  get: () => cachedToken,
  /** AuthProvider đăng ký hàm này để tự đăng xuất khi token hết hạn */
  onUnauthorized(fn: () => void) {
    onUnauthorized = fn;
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T = unknown>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cachedToken && { Authorization: `Bearer ${cachedToken}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Không kết nối được máy chủ (${API_URL}). Kiểm tra API đã chạy và điện thoại cùng mạng Wi-Fi.`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && cachedToken) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? 'Có lỗi xảy ra', data.details);
  }
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
