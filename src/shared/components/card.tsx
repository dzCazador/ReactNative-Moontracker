import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated = false }: CardProps) {
  return (
    <View
      style={[
        styles.container,
        elevated ? styles.elevated : styles.base,
        { backgroundColor: colors.dark.surface },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: tokens.borderRadius.md,
    overflow: 'hidden',
  },
  base: {
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  elevated: {
    borderWidth: 1,
    borderColor: colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});
