// BCH · Sửa sự kiện (màn đẩy chồng lên tab)
import { useLocalSearchParams } from 'expo-router';
import { EventFormScreen } from '@/components/EventFormScreen';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventFormScreen id={id} />;
}
