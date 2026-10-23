'use client';
// BCH · Sửa sự kiện (chỉ khi sự kiện chưa diễn ra)
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EventForm } from '@/components/EventForm';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import type { EventDetail } from '@/lib/types';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<{ event: EventDetail }>(`/events/${id}`);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  if (!data.event.permissions.canEdit) {
    return (
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-navy">Sự kiện đã diễn ra nên không thể chỉnh sửa.</p>
        <Link href={`/events/${id}`}>
          <Button variant="outline">Xem chi tiết</Button>
        </Link>
      </div>
    );
  }
  return <EventForm event={data.event} />;
}
