import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

export const MAX_FADE_MS = 60000;

interface FadeInputProps {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  error?: string;
  style?: ViewStyle;
}

export function FadeInput({ label, value, onChange, error, style }: FadeInputProps) {
  const textValue = value == null ? '' : String(value);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={textValue}
        onChangeText={(text) => {
          const trimmed = text.trim();
          if (trimmed === '') {
            onChange(null);
            return;
          }
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_FADE_MS) {
            return;
          }
          onChange(parsed);
        }}
        keyboardType="numeric"
        placeholder={`0 a ${MAX_FADE_MS} ms`}
        maxLength={5}
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    marginLeft: 2,
  },
  input: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: tokens.touchTarget.min,
  },
  inputError: {
    borderColor: colors.dark.danger,
  },
  errorText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.sm,
    marginLeft: 2,
  },
});
