// Lưu token an toàn: điện thoại dùng expo-secure-store (Keychain iOS / Keystore Android).
// Khi chạy bản web (expo start --web) không có SecureStore -> dùng localStorage.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  async get(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};
