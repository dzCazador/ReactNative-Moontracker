import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, FlatList } from 'react-native';
import { AudioAssetRepository } from '@/data/db/repositories/audio-asset-repository';
import type { AudioAsset } from '@/data/models';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from '@/shared/components/large-button';
import { EmptyState } from '@/shared/components/empty-state';
import { Card } from '@/shared/components/card';
import { Skeleton } from '@/shared/components/skeleton';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ImportAudioModal } from '@/shared/components/import-audio-modal';
import {
  copyFileToAppStorageAsync,
  deleteFileAsync,
  pickAudioFileAsync,
  detectMissingFilesAsync,
} from '@/services/filesystem';
import { logger } from '@/lib/logger';
import { ImportError, AudioAssetInUseError } from '@/lib/errors';

type AudioTypeFilter = 'ALL' | 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';

export default function AudioLibraryScreen() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [filter, setFilter] = useState<AudioTypeFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AudioAsset | null>(null);

  const repo = useMemo(() => new AudioAssetRepository(), []);

  const filteredAssets = useMemo(() => {
    if (filter === 'ALL') return assets;
    return assets.filter((a) => a.type === filter);
  }, [assets, filter]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Detect missing files first so the UI reflects current disk state.
      await detectMissingFilesAsync();
      const data = await repo.list({ includeMissing: true });
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la biblioteca');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssets();
  }, [loadAssets]);

  const handleImport = async () => {
    setImportVisible(true);
  };

  const handleImported = (_audio: { id: string; display_name: string; type: string }) => {
    setImportVisible(false);
    void loadAssets();
  };

  const handleRelink = async (asset: AudioAsset) => {
    await performRelink(asset);
  };

  const performRelink = async (asset: AudioAsset) => {
    setLoading(true);
    try {
      const picked = await pickAudioFileAsync({ multiple: false });
      if (picked.length === 0) {
        setLoading(false);
        return;
      }
      const pickedAsset = picked[0];
      if (!pickedAsset.uri || !pickedAsset.name) {
        throw new ImportError('No se pudo leer el archivo seleccionado', { uri: pickedAsset.uri });
      }

      const copied = await copyFileToAppStorageAsync({
        uri: pickedAsset.uri,
        originalFilename: pickedAsset.name,
      });

      await repo.update({
        id: asset.id,
        internal_uri: copied.internalUri,
        file_size_bytes: copied.size,
        file_extension: copied.fileName.endsWith('.') ? '' : `.${copied.fileName.split('.').pop()}`,
        mime_type: pickedAsset.mimeType ?? null,
        original_filename: pickedAsset.name,
        display_name: pickedAsset.name,
        is_missing: false,
      });

      // Borra el archivo anterior solo si cambió de ubicación.
      if (asset.internal_uri !== copied.internalUri) {
        await deleteFileAsync(asset.internal_uri);
      }

      logger.info('[audio-library] archivo revinculado', {
        audioId: asset.id,
        internalUri: copied.internalUri,
      });

      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revincular el archivo de audio');
      logger.error('[audio-library] relink failed', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (asset: AudioAsset) => {
    setAssetToDelete(asset);
    setDeleteConfirmVisible(true);
  };

  const confirmDeleteAsset = async () => {
    if (!assetToDelete) return;
    try {
      await repo.delete(assetToDelete.id, { force: false });
      await deleteFileAsync(assetToDelete.internal_uri);
      setAssetToDelete(null);
      setDeleteConfirmVisible(false);
      await loadAssets();
    } catch (err) {
      if (err instanceof AudioAssetInUseError) {
        setError(
          'No se puede eliminar este audio porque está usado por una o más canciones de setlist. Quítalo de las setlists primero.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar el audio');
      }
    } finally {
      setAssetToDelete(null);
      setDeleteConfirmVisible(false);
    }
  };

  const typeLabel = ((): string => {
    if (filter === 'MAIN_TRACK') return 'Pistas principales';
    if (filter === 'INTERMEDIATE_LOOP') return 'Loops intermedios';
    return 'Todos los audios';
  })();

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.skeletonWrapper}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonItem}>
            <Skeleton width="55%" height={20} />
            <Skeleton style={styles.skeletonLine} width="45%" height={16} marginTop={6} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Biblioteca de audio</Text>
          <Text style={styles.sub}>Importa y gestiona tus archivos de audio.</Text>
        </View>
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <LargeButton title="Reintentar" onPress={loadAssets} style={styles.retryButton} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Biblioteca de audio</Text>
        <Text style={styles.sub}>
          Archivos importados y descargados, disponibles para pistas principales y loops
          intermedios.
        </Text>
      </View>

      <View style={styles.filterBar}>
        {(['ALL', 'MAIN_TRACK', 'INTERMEDIATE_LOOP'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filter === type && styles.filterChipActive]}
            onPress={() => setFilter(type)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === type }}
          >
            <Text style={[styles.filterChipText, filter === type && styles.filterChipTextActive]}>
              {type === 'ALL' ? 'Todos' : type === 'MAIN_TRACK' ? 'Principal' : 'Intermedio'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filteredAssets.length} archivo{filteredAssets.length !== 1 ? 's' : ''} ({typeLabel})
        </Text>
        <LargeButton title="+ Importar audio" style={styles.importButton} onPress={handleImport} />
      </View>

      {filteredAssets.length === 0 ? (
        <EmptyState
          title="No hay audio importado"
          subtitle="Importa archivos de audio (.wav, .ogg, .flac) o descárgalos desde un enlace para usarlos como pistas principales o loops intermedios."
          actionTitle="Importar audio"
          onActionPress={handleImport}
        />
      ) : (
        <FlatList
          data={filteredAssets}
          renderItem={({ item }) => {
            const typeLabel = item.type === 'MAIN_TRACK' ? 'Pista principal' : 'Loop intermedio';
            const duration = item.duration_ms
              ? `${Math.floor(item.duration_ms / 60000)}:${String(
                  Math.floor((item.duration_ms % 60000) / 1000)
                ).padStart(2, '0')}`
              : '--:--';
            const size =
              item.file_size_bytes != null
                ? `${(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                : '--';
            const origin = item.source_url ? 'Descarga' : 'Local';
            return (
              <Card key={item.id} style={styles.row}>
                <View style={styles.rowContent}>
                  <View style={styles.rowInfo}>
                    <View style={styles.rowTypeBadge}>
                      <Text style={styles.rowTypeBadgeText}>
                        {item.type === 'MAIN_TRACK' ? 'M' : 'L'}
                      </Text>
                    </View>
                    <View style={styles.rowTexts}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.display_name}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {typeLabel} • {origin} • {duration} • {size}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    {item.is_missing ? (
                      <LargeButton
                        title="Relink"
                        style={styles.relinkButton}
                        onPress={() => handleRelink(item)}
                      />
                    ) : null}
                    <LargeButton
                      title="Eliminar"
                      style={[styles.dangerButton, styles.iconButton]}
                      onPress={() => handleDeleteAsset(item)}
                    />
                  </View>
                </View>
                {item.is_missing && (
                  <View style={styles.rowMissingBanner}>
                    <Text style={styles.rowMissingText}>
                      ⚠ Archivo faltante en disco. Usa &quot;Relink&quot; para volver a vincularlo.
                    </Text>
                  </View>
                )}
              </Card>
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}

      <LargeButton title="+ Importar audio" style={styles.fab} onPress={handleImport} />

      {importVisible && (
        <ImportAudioModal
          visible={importVisible}
          onImported={handleImported}
          onCancel={() => setImportVisible(false)}
        />
      )}

      {deleteConfirmVisible && assetToDelete && (
        <ConfirmDialog
          visible={deleteConfirmVisible}
          title="Eliminar audio"
          message={`¿Eliminar "${assetToDelete.display_name}" de la biblioteca? Si está usado en una canción, la eliminación será bloqueada.`}
          confirmTitle="Eliminar"
          cancelTitle="Cancelar"
          destructive
          onConfirm={confirmDeleteAsset}
          onCancel={() => {
            setAssetToDelete(null);
            setDeleteConfirmVisible(false);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
    padding: tokens.spacing.md,
  },
  content: {
    paddingBottom: tokens.spacing.xl,
  },
  skeletonWrapper: {
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  header: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.xl,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  sub: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
  },
  filterBar: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  filterChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.dark.border,
    backgroundColor: colors.dark.surface,
  },
  filterChipActive: {
    borderColor: colors.dark.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
  },
  filterChipText: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.dark.accent,
  },
  countBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  countText: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  importButton: {
    minWidth: 140,
  },
  listContent: {
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  row: {
    marginBottom: 0,
  },
  rowContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowTypeBadge: {
    width: 30,
    height: 30,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  rowTypeBadgeText: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
  },
  rowTexts: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: tokens.spacing.xs,
  },
  relinkButton: {
    minWidth: 80,
    minHeight: tokens.touchTarget.min,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.warning,
  },
  dangerButton: {
    minWidth: 70,
    minHeight: tokens.touchTarget.min,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
  },
  iconButton: {},
  rowMissingBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.warning,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  rowMissingText: {
    color: colors.dark.warning,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: tokens.spacing.lg,
    right: tokens.spacing.lg,
    minWidth: 170,
    backgroundColor: colors.dark.accent,
  },
  errorBlock: {
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  errorText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.md,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  retryButton: {
    minWidth: 160,
  },
  skeletonItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingVertical: 6,
  },
  skeletonLine: {
    backgroundColor: colors.dark.surfaceElevated,
  },
});
