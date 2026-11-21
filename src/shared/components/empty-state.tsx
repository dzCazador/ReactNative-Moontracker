import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from './large-button';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  actionTitle?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  subtitle,
  actionTitle,
  onActionPress,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionTitle && onActionPress && (
        <LargeButton title={actionTitle} onPress={onActionPress} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.md,
  },
  button: {
    minWidth: 200,
  },
});
