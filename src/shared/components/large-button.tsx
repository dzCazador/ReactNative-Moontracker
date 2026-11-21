import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import type { Insets } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

interface LargeButtonProps {
  title: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
  hitSlop?: Insets;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** When true, text is rendered white (for use on accent/colored backgrounds). */
  light?: boolean;
}

export function LargeButton({
  title,
  style,
  textStyle,
  onPress,
  hitSlop,
  disabled,
  accessibilityLabel,
  light,
}: LargeButtonProps) {
  return (
    <Pressable
      style={[
        styles.button,
        disabled && styles.disabled,
        style,
      ]}
      hitSlop={hitSlop}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Text style={[styles.text, light && styles.textLight, textStyle]}>{title}</Text>
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
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  textLight: {
    color: '#ffffff',
  },
});
