// Bộ component giao diện cho app mobile (theo Figma bản Mobile 375px)
import Feather from '@expo/vector-icons/Feather';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { initials } from '@/lib/format';

export type IconName = ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 16, color = colors.primary }: { name: IconName; size?: number; color?: string }) => (
  <Feather name={name} size={size} color={color} />
);

// ---------------- Chữ ----------------
type TProps = {
  children: ReactNode;
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'bold';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  upper?: boolean;
};
export function T({ children, size = 13, color = colors.navy, weight = 'regular', style, numberOfLines, upper }: TProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontSize: size, color, fontFamily: fonts[weight], lineHeight: size * 1.45 }, upper && { textTransform: 'uppercase' }, style]}
    >
      {children}
    </Text>
  );
}

// ---------------- Khung màn hình cuộn được + kéo để làm mới ----------------
export function Screen({ children, onRefresh, refreshing = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ice }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({ eyebrow, title, description, meta }: { eyebrow: string; title: string; description?: string; meta?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T size={11} color={colors.primary} upper>
        {eyebrow}
      </T>
      <T size={26} weight="bold">
        {title}
      </T>
      {description && <T color={colors.muted}>{description}</T>}
      {meta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={13} />
          <T size={11} color={colors.muted}>
            {meta}
          </T>
        </View>
      )}
    </View>
  );
}

// ---------------- Thẻ ----------------
export function Card({ children, style, dark }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && { backgroundColor: colors.navy, borderColor: colors.navy }, style]}>{children}</View>;
}

export function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: string; icon?: IconName }) {
  return (
    <Card style={{ flex: 1, minWidth: 100, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={11} color={colors.muted} style={{ flex: 1 }}>
          {label}
        </T>
        {icon && <Icon name={icon} size={15} />}
      </View>
      <T size={26} weight="bold">
        {value}
      </T>
      {sub && (
        <T size={10} color={colors.muted}>
          {sub}
        </T>
      )}
    </Card>
  );
}

// ---------------- Nút ----------------
type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && { minHeight: 34, paddingHorizontal: 12 },
        variant === 'primary' && { backgroundColor: colors.primary, borderColor: colors.primary },
        variant === 'outline' && { backgroundColor: colors.white, borderColor: colors.line },
        variant === 'ghost' && { backgroundColor: 'transparent', borderColor: 'transparent' },
        variant === 'danger' && { backgroundColor: colors.white, borderColor: '#e8b4ae' },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon && <Icon name={icon} size={small ? 14 : 16} color={fg} />}
      <T size={small ? 12 : 14} color={fg}>
        {title}
      </T>
    </Pressable>
  );
}

// ---------------- Ô nhập ----------------
export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {label && <T size={12}>{label}</T>}
      {children}
      {error ? (
        <T size={11} color={colors.danger}>
          {error}
        </T>
      ) : (
        hint && (
          <T size={11} color={colors.muted}>
            {hint}
          </T>
        )
      )}
    </View>
  );
}

export function Input({ icon, secure, light, style, ...props }: TextInputProps & { icon?: IconName; secure?: boolean; light?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.inputWrap, light && { backgroundColor: colors.white }]}>
      <TextInput
        placeholderTextColor="#7f97a8"
        secureTextEntry={secure && hidden}
        autoCapitalize="none"
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, style]}
        {...props}
      />
      {secure ? (
        <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}>
          <Icon name={hidden ? 'eye-off' : 'eye'} size={18} />
        </Pressable>
      ) : (
        icon && <Icon name={icon} size={18} />
      )}
    </View>
  );
}

// ---------------- Nhãn ----------------
export function Badge({ children, tone = 'ice' }: { children: ReactNode; tone?: 'ice' | 'navy' | 'outline' }) {
  const bg = tone === 'navy' ? colors.navy : tone === 'outline' ? colors.white : colors.ice;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, tone === 'outline' && { borderWidth: 1, borderColor: colors.line }]}>
      <T size={11} color={tone === 'navy' ? colors.white : colors.navy}>
        {children}
      </T>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.ice, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: colors.sky, borderRadius: 3 }} />
    </View>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size * 0.34} weight="medium">
        {initials(name)}
      </T>
    </View>
  );
}

export function Chips<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <T size={12} color={on ? colors.white : colors.primary}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.line }} thumbColor={colors.white} />;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, backgroundColor: colors.ice }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: 12 }}>
      <T color={colors.danger} style={{ textAlign: 'center' }}>
        {message}
      </T>
      {onRetry && <Button small variant="outline" title="Thử lại" onPress={onRetry} />}
    </Card>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const bg = tone === 'error' ? '#fdecea' : tone === 'success' ? colors.white : colors.soft;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, borderWidth: 1, borderColor: tone === 'error' ? '#f3c4be' : colors.line, padding: 12 }}>
      <T size={12} color={tone === 'error' ? colors.danger : colors.navy}>
        {children}
      </T>
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.divider }} />;

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16 },
  btn: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  inputWrap: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ice,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, minHeight: 44, fontSize: 13, color: colors.navy, fontFamily: fonts.regular },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, justifyContent: 'center' },
});
