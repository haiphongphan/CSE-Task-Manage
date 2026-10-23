// Bố cục màn Đăng ký / Đăng nhập (Figma: "Sign up · Mobile")
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { Divider, Icon, T } from './ui';

export function AuthScreen({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="layers" size={20} color={colors.white} />
            </View>
            <T size={18} weight="bold">
              CSE Task Manage
            </T>
          </View>
          <View style={{ gap: 8, marginTop: 16 }}>
            <T size={11} color={colors.primary} upper>
              {eyebrow}
            </T>
            <T size={30} weight="bold">
              {title}
            </T>
            <T size={14} color={colors.muted}>
              {subtitle}
            </T>
          </View>
          {children}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Icon name="shield" size={14} />
            <T size={11} color={colors.muted}>
              Không gian làm việc an toàn, phân quyền theo vai trò.
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
