import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import type { Insets } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

interface LargeButtonProps {
  title: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  hitSlop?: Insets;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function LargeButton({
  title,
  style,
  onPress,
  hitSlop,
  disabled,
  accessibilityLabel,
  ...rest
}: LargeButtonProps) {
  return (
    <Pressable
      style={[styles.button, style]}
      hitSlop={hitSlop}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      {...rest}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.touchTarget.comfortable,
    minWidth: tokens.touchTarget.comfortable,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: colors.dark.pressable,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  text: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
});
