// Admin · Quản lý sự kiện: dùng chung danh sách với "Sự kiện của tôi" của BCH
import { EventsList } from './BchEvents';

export default function AdminEventsScreen() {
  return <EventsList mode="ADMIN" />;
}
