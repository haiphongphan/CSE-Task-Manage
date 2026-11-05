'use client';
// Admin · Quản lý sự kiện: dùng chung giao diện với "Sự kiện của tôi" của BCH
import { EventsManager } from '@/components/EventsManager';

export default function AdminEventsPage() {
  return <EventsManager mode="ADMIN" />;
}
