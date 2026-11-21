import { Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import type { AudioAsset } from '@/data/models';
import { LargeButton } from './large-button';
import { EmptyState } from './empty-state';
import { AudioAssetRow } from './audio-asset-row';

interface AssetPickerModalProps {
  visible: boolean;
  title: string;
  type: 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';
  assets: AudioAsset[];
  onSelect: (asset: AudioAsset) => void;
  onCancel: () => void;
  onImport: () => void;
  style?: ViewStyle;
}

export function AssetPickerModal({
  visible,
  title,
  type,
  assets,
  onSelect,
  onCancel,
  onImport,
  style,
}: AssetPickerModalProps) {
  const filtered = assets.filter((a) => a.type === type);
  const missingCount = filtered.filter((a) => a.is_missing).length;

  return (
    <Modal visible={visible} transparent onRequestClose={onCancel} style={[styles.backdrop, style]}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {type === 'MAIN_TRACK'
              ? 'Selecciona la pista principal de la canción'
              : 'Selecciona el loop intermedio'}
          </Text>
          {missingCount > 0 && (
            <Text style={styles.missingHint}>
              {missingCount} archivo(s) faltante(s) — usa &quot;Relink&quot; en la biblioteca para
              restaurarlo.
            </Text>
          )}
          {filtered.length === 0 ? (
            <EmptyState
              title="Sin audios disponibles"
              subtitle={`No hay audios de tipo "${type}" importados aún.`}
              actionTitle="Importar audio"
              onActionPress={onImport}
            />
          ) : (
            <View style={styles.list}>
              {filtered.map((asset) => (
                <AudioAssetRow key={asset.id} asset={asset} onPress={onSelect} selected={false} />
              ))}
            </View>
          )}
          <LargeButton
            title="Importar audio nuevo"
            style={styles.importButton}
            onPress={onImport}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: '92%',
    maxWidth: 460,
    padding: tokens.spacing.sm,
  },
  card: {
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
  },
  close: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    marginBottom: tokens.spacing.sm,
  },
  missingHint: {
    color: colors.dark.warning,
    fontSize: tokens.fontSize.sm,
    marginBottom: tokens.spacing.md,
    fontWeight: '600',
  },
  list: {
    gap: tokens.spacing.sm,
    maxHeight: 300,
  },
  importButton: {
    marginTop: tokens.spacing.md,
  },
});
