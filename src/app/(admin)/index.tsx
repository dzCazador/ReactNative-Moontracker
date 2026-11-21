import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/(admin)/param-list';
import { LargeButton } from '@/shared/components/large-button';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

export default function AdminIndex() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <View style={[styles.container, { backgroundColor: colors.dark.background }]}>
      <Text style={styles.title}>Admin / Gestión</Text>
      <Text style={styles.sub}>Setlists, biblioteca, importación y ajustes.</Text>
      <LargeButton
        title="Ir a Modo En Vivo"
        style={styles.button}
        onPress={() => navigation.navigate('Live')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      />
      <LargeButton
        title="Setlists"
        style={[styles.button, { marginTop: tokens.spacing.sm }]}
        onPress={() => navigation.navigate('Setlists')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      />
      <LargeButton
        title="Biblioteca de Audio"
        style={[styles.button, { marginTop: tokens.spacing.sm }]}
        onPress={() => navigation.navigate('Library')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      />
      <LargeButton
        title="Ajustes"
        style={[styles.button, { marginTop: tokens.spacing.sm }]}
        onPress={() => navigation.navigate('Settings')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.dark.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sub: {
    color: colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    minWidth: 220,
  },
});
