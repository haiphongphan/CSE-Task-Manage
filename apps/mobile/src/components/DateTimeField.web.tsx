// Bản web (expo start --web): thư viện datetimepicker không hỗ trợ web -> dùng ô nhập chữ.
// Metro tự chọn file *.web.tsx khi build cho web.
import { Input } from './ui';

export function DateTimeField({ mode, value, onChange }: { mode: 'date' | 'time'; value: string; onChange: (v: string) => void }) {
  return <Input value={value} onChangeText={onChange} placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm'} />;
}
