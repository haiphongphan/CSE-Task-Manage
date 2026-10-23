// Ô chọn ngày / giờ trên điện thoại (dùng @react-native-community/datetimepicker).
// Giá trị là chuỗi: ngày 'YYYY-MM-DD', giờ 'HH:mm' (giờ Việt Nam).
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Icon, T, styles } from './ui';
import { colors } from '@/lib/theme';

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(mode: 'date' | 'time', value: string) {
  const now = new Date();
  if (mode === 'date' && value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  if (mode === 'time' && value) {
    const [h, mi] = value.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, mi, 0, 0);
    return d;
  }
  return now;
}

export function DateTimeField({ mode, value, onChange }: { mode: 'date' | 'time'; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  const handle = (_: DateTimePickerEvent, d?: Date) => {
    setOpen(false);
    if (!d) return;
    onChange(mode === 'date' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  // iOS: picker dạng "compact" hiển thị luôn trong dòng
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.inputWrap, { justifyContent: 'flex-start' }]}>
        <DateTimePicker value={toDate(mode, value)} mode={mode} display="compact" locale="vi-VN" onChange={handle} accentColor={colors.primary} />
      </View>
    );
  }

  // Android: bấm vào ô -> mở hộp thoại chọn
  const label = value ? (mode === 'date' ? value.split('-').reverse().join('/') : value) : mode === 'date' ? 'Chọn ngày' : 'Chọn giờ';
  return (
    <>
      <Pressable style={styles.inputWrap} onPress={() => setOpen(true)}>
        <T color={value ? colors.navy : colors.muted} style={{ flex: 1 }}>
          {label}
        </T>
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} />
      </Pressable>
      {open && <DateTimePicker value={toDate(mode, value)} mode={mode} is24Hour onChange={handle} />}
    </>
  );
}
