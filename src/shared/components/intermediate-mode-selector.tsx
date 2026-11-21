import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import type { IntermediateMode } from '@/data/models';

interface IntermediateModeOption {
  value: IntermediateMode;
  label: string;
  hint: string;
}

const OPTIONS: IntermediateModeOption[] = [
  {
    value: 'GLOBAL_DEFAULT',
    label: 'Predeterminado global',
    hint: 'Usa el loop intermedio configurado en Ajustes.',
  },
  {
    value: 'CUSTOM',
    label: 'Intermedio personalizado',
    hint: 'Requiere elegir un audio de la biblioteca.',
  },
  {
    value: 'SILENCE',
    label: 'Silencio',
    hint: 'Sin loop intermedio entre canciones.',
  },
];

interface IntermediateModeSelectorProps {
  value: IntermediateMode;
  onChange: (value: IntermediateMode) => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export function IntermediateModeSelector({
  value,
  onChange,
  style,
  disabled = false,
}: IntermediateModeSelectorProps) {
  return (
    <View style={[styles.container, style]}>
      {OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.option,
            option.value === value && styles.selected,
            disabled && styles.disabled,
          ]}
          onPress={() => !disabled && onChange(option.value)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="radio"
          accessibilityState={{ checked: option.value === value }}
          accessibilityLabel={`${option.label}: ${option.hint}`}
        >
          <View style={styles.dotContainer}>
            <View style={[styles.dot, option.value === value && styles.dotSelected]} />
          </View>
          <View style={styles.texts}>
            <Text style={[styles.label, option.value === value && styles.labelSelected]}>
              {option.label}
            </Text>
            <Text style={styles.hint}>{option.hint}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: colors.dark.surfaceElevated,
    minHeight: tokens.touchTarget.comfortable,
  },
  selected: {
    borderColor: colors.dark.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  disabled: {
    opacity: 0.55,
    borderColor: colors.dark.border,
    backgroundColor: colors.dark.surface,
  },
  dotContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.dark.textSecondary,
  },
  dotSelected: {
    borderColor: colors.dark.accent,
    backgroundColor: colors.dark.accent,
  },
  texts: {
    flex: 1,
  },
  label: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.dark.accent,
  },
  hint: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: 2,
  },
});
