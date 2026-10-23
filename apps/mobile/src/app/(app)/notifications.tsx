// Hộp thư thông báo (mọi vai trò)
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Alert, Button, Card, ErrorBox, Icon, Loading, PageHeader, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { fmtDayTime } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  MANUAL_REMIND: 'Nhắc việc từ BCH',
  PHOTO_REMINDER: 'Nhắc chụp ảnh',
  RECAP_REMINDER: 'Nhắc recap',
  DEADLINE_ALERT: 'Sắp tới hạn',
  EVENT_ASSIGNED: 'Phân công mới',
  TASK_UPDATED: 'Cập nhật',
};

export default function NotificationsScreen() {
  const { pushMode, pushReason } = useAuth();
  const { data, error, loading, reload } = useApi<{ items: AppNotification[]; unreadCount: number }>('/notifications?limit=100', { pollMs: 30_000 });

  return (
    <Screen onRefresh={reload}>
      <PageHeader eyebrow="Hộp thư" title="Thông báo" description="Nhắc nhở tự động, nhắc việc từ BCH và cập nhật về sự kiện của bạn." />
      <Alert>
        {pushMode === 'push'
          ? '🔔 Đã bật push thật: bạn sẽ nhận thông báo cả khi app đang tắt.'
          : pushMode === 'polling'
            ? `🔔 Chế độ demo: app tự kiểm tra thông báo mới mỗi 30 giây khi đang mở.${pushReason ? `\n(${pushReason})` : ''}`
            : `Thông báo trên máy đang tắt.${pushReason ? ` ${pushReason}` : ''}`}
      </Alert>
      <Button
        title="Đánh dấu tất cả đã đọc"
        variant="outline"
        icon="check"
        onPress={async () => {
          await api('/notifications/read-all', { method: 'POST' });
          void reload();
        }}
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <T color={colors.muted} style={{ textAlign: 'center' }}>
            Chưa có thông báo nào
          </T>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {data.items.map((n) => (
            <Pressable
              key={n.id}
              onPress={async () => {
                if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
                if (n.eventId) router.push(`/events/${n.eventId}`);
                else void reload();
              }}
              style={{ flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: colors.divider, backgroundColor: n.isRead ? colors.white : colors.soft }}
            >
              <Icon name="bell" size={18} color={n.isRead ? colors.line : colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={10} color={colors.primary} upper>
                  {TYPE_LABEL[n.type] ?? n.type}
                </T>
                <T weight="medium">{n.title}</T>
                <T size={12} color={colors.muted}>
                  {n.body}
                </T>
                <T size={10} color={colors.muted}>
                  {fmtDayTime(n.createdAt)} · {n.sentBy ? `từ ${n.sentBy.fullName}` : 'hệ thống'}
                </T>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
