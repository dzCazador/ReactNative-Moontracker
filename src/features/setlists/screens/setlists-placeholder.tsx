import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/colors';

export default function SetlistsPlaceholder() {
  return (
    <View style={[styles.container, { backgroundColor: colors.dark.surface }]}>
      <Text style={styles.title}>Setlists</Text>
      <Text style={styles.sub}>Gestión de setlists y canciones — disponible en la etapa 02.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.dark.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sub: {
    color: colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
