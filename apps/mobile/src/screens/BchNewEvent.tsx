// BCH · Tab "Tạo sự kiện"
import { useState } from 'react';
import { EventFormScreen } from '@/components/EventFormScreen';

export default function NewEventTab() {
  // Lưu xong thì đổi key -> form được tạo mới (xoá trắng) cho lần tạo tiếp theo
  const [formKey, setFormKey] = useState(0);
  return <EventFormScreen key={formKey} onSaved={() => setFormKey((k) => k + 1)} />;
}
