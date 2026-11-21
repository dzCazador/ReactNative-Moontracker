import { View, Text, Button, StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { useLiveModeStore } from '@/lib/live-mode-store';

export default function LivePlaceholder() {
  const isActive = useLiveModeStore((s) => s.isActive);
  const setActive = useLiveModeStore((s) => s.setActive);

  return (
    <View style={[styles.container, { backgroundColor: colors.dark.background }]}>
      <Text style={styles.title}>Modo En Vivo</Text>
      <Text style={styles.status}>Estado: {isActive ? 'Actuación activa' : 'Espera en loop'}</Text>
      <Button
        title={isActive ? 'Finalizar actuación' : 'Iniciar actuación'}
        onPress={() => setActive(!isActive)}
        color={colors.dark.accent}
      />
      <Text style={styles.hint}>
        El guardián de salida está activo: se confirma antes de abandonar una actuación.
      </Text>
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
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  status: {
    color: colors.dark.textSecondary,
    fontSize: 15,
    marginBottom: 20,
  },
  hint: {
    color: colors.dark.textMuted,
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
});
