import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SetlistRepository } from '@/data/db/repositories/setlist-repository';
import { SetlistItemRepository } from '@/data/db/repositories/setlist-item-repository';
import { AudioAssetRepository } from '@/data/db/repositories/audio-asset-repository';
import { AppSettingsRepository } from '@/data/db/repositories/app-settings-repository';
import type { SetlistWithCounts, SetlistItemWithAudio, AudioAsset } from '@/data/models';
import { updateSetlistItem } from '@/features/setlists/services/setlist-item-service';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from '@/shared/components/large-button';
import { EmptyState } from '@/shared/components/empty-state';
import { Card } from '@/shared/components/card';
import { Skeleton } from '@/shared/components/skeleton';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { FormField } from '@/shared/components/form-field';
import { SongEditor } from '@/features/setlists/components/song-editor';
import { SetlistItemRow } from '@/features/setlists/components/setlist-item-row';

type SetlistsStackParamList = {
  SetlistDetail: { setlistId: string };
};
type Route = RouteProp<SetlistsStackParamList, 'SetlistDetail'>;

const GLOBAL_INTERMEDIATE_SETTING_KEY = 'settings:global_intermediate_audio_id';

export default function SetlistDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { setlistId } = route.params;

  const [setlist, setSetlist] = useState<SetlistWithCounts | null>(null);
  const [items, setItems] = useState<SetlistItemWithAudio[]>([]);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SetlistItemWithAudio | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [metadataName, setMetadataName] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');

  const setlistRepo = useMemo(() => new SetlistRepository(), []);
  const itemRepo = useMemo(() => new SetlistItemRepository(), []);
  const assetRepo = useMemo(() => new AudioAssetRepository(), []);
  const settingsRepo = useMemo(() => new AppSettingsRepository(), []);

  const [globalDefaultAudioId, setGlobalDefaultAudioId] = useState<string | null>(null);

  const mainAssets = useMemo(() => assets.filter((a) => a.type === 'MAIN_TRACK'), [assets]);
  const intermediateAssets = useMemo(
    () => assets.filter((a) => a.type === 'INTERMEDIATE_LOOP'),
    [assets]
  );

  const assetsById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const loadSetlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [setlistData, live, allAssets, globalDefault] = await Promise.all([
        setlistRepo.getById(setlistId),
        itemRepo.loadSetlistForLive(setlistId),
        assetRepo.list({ includeMissing: true }),
        settingsRepo.getSetting<string | null>(GLOBAL_INTERMEDIATE_SETTING_KEY),
      ]);

      setItems(live.items);
      if (setlistData) setSetlist(setlistData);
      setAssets(allAssets);
      setGlobalDefaultAudioId(globalDefault ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la setlist');
    } finally {
      setLoading(false);
    }
  }, [setlistId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSetlist();
  }, [loadSetlist]);

  const estimatedDurationMs = useMemo(() => {
    if (items.some((i) => !i.main_audio || i.main_audio.duration_ms == null)) return null;
    return items.reduce((sum, i) => sum + (i.main_audio?.duration_ms ?? 0), 0);
  }, [items]);

  const handleAddSong = () => {
    setEditingItem(null);
    setEditorVisible(true);
  };

  const handleEditSong = (item: SetlistItemWithAudio) => {
    setEditingItem(item);
    setEditorVisible(true);
  };

  const handleSaveSong = async (input: {
    song_title: string;
    artist: string | null;
    notes: string | null;
    main_audio_id: string;
    intermediate_mode: 'GLOBAL_DEFAULT' | 'CUSTOM' | 'SILENCE';
    intermediate_audio_id: string | null;
    fade_in_loop_ms: number | null;
    fade_out_loop_ms: number | null;
  }) => {
    try {
      if (editingItem) {
        await updateSetlistItem(editingItem.id, {
          song_title: input.song_title,
          artist: input.artist,
          notes: input.notes,
          main_audio_id: input.main_audio_id,
          intermediate_audio_id: input.intermediate_audio_id,
          intermediate_mode: input.intermediate_mode,
          fade_out_loop_ms: input.fade_out_loop_ms,
          fade_in_loop_ms: input.fade_in_loop_ms,
        });
      } else {
        await itemRepo.add({
          setlist_id: setlistId,
          song_title: input.song_title,
          artist: input.artist,
          main_audio_id: input.main_audio_id,
          intermediate_audio_id: input.intermediate_audio_id,
          intermediate_mode: input.intermediate_mode,
          notes: input.notes,
          fade_out_loop_ms: input.fade_out_loop_ms,
          fade_in_loop_ms: input.fade_in_loop_ms,
        });
      }
      setEditorVisible(false);
      setEditingItem(null);
      await loadSetlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la canción');
    }
  };

  const handleDeleteSong = async () => {
    if (!itemToDelete) return;
    try {
      await itemRepo.remove(itemToDelete);
      setItemToDelete(null);
      setDeleteConfirmVisible(false);
      await loadSetlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la canción');
    } finally {
      setItemToDelete(null);
      setDeleteConfirmVisible(false);
    }
  };

  const handleMove = async (itemId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await itemRepo.move(setlistId, itemId, item.position + delta);
      await loadSetlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reordenar la canción');
    }
  };

  const handleSaveMetadata = async () => {
    try {
      await setlistRepo.update({
        id: setlistId,
        name: metadataName.trim() || setlist?.name,
        description: metadataDescription.trim() || null,
      });
      setMetadataVisible(false);
      await loadSetlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la setlist');
    }
  };

  const formatDuration = (ms: number | null): string => {
    if (ms == null) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.skeletonWrapper}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonItem}>
            <Skeleton width="60%" height={20} />
            <Skeleton style={styles.skeletonLine} width="40%" height={16} marginTop={6} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <LargeButton title="Reintentar" onPress={loadSetlist} style={styles.retryButton} />
        </View>
      </ScrollView>
    );
  }

  const durationText =
    estimatedDurationMs == null
      ? 'Duración no disponible'
      : `Duración estimada: ${formatDuration(estimatedDurationMs)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Volver a setlists"
        >
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.metaCard}>
        <Text style={styles.metaTitle}>{setlist?.name ?? 'Setlist'}</Text>
        <LargeButton
          title="Editar detalles"
          style={styles.editMetaButton}
          onPress={() => {
            setMetadataName(setlist?.name ?? '');
            setMetadataDescription(setlist?.description ?? '');
            setMetadataVisible(true);
          }}
        />
        {setlist?.description && <Text style={styles.metaDescription}>{setlist.description}</Text>}
        <View style={styles.metaStats}>
          <Text style={styles.stat}>
            {items.length} canción{items.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.stat}>{durationText}</Text>
          {setlist?.has_missing_audio && (
            <Text style={styles.statMissing}>⚠ Contiene audio faltante</Text>
          )}
        </View>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Sin canciones aún"
          subtitle="Agrega tu primera canción. Necesitarás seleccionar una pista principal de audio desde la biblioteca."
          actionTitle="Agregar canción"
          onActionPress={handleAddSong}
        />
      ) : (
        <FlatList
          data={items}
          renderItem={({ item }) => (
            <SetlistItemRow
              item={item}
              position={item.position}
              setlistDefaultAudioId={setlist?.default_intermediate_audio_id ?? null}
              globalDefaultAudioId={globalDefaultAudioId}
              assetsById={assetsById}
              onEdit={handleEditSong}
              onDelete={(id) => {
                setItemToDelete(id);
                setDeleteConfirmVisible(true);
              }}
              onMoveUp={(id) => handleMove(id, -1)}
              onMoveDown={(id) => handleMove(id, 1)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}

      <LargeButton title="+ Agregar canción" style={styles.addButton} onPress={handleAddSong} />

      {editorVisible && (
        <SongEditor
          visible={editorVisible}
          setlistId={setlistId}
          item={editingItem ?? undefined}
          mainAssets={mainAssets}
          intermediateAssets={intermediateAssets}
          onSave={handleSaveSong}
          onCancel={() => {
            setEditorVisible(false);
            setEditingItem(null);
          }}
        />
      )}

      {deleteConfirmVisible && itemToDelete && (
        <ConfirmDialog
          visible={deleteConfirmVisible}
          title="Eliminar canción"
          message="¿Estás seguro de que quieres quitar esta canción de la setlist? La pista de audio no se eliminará de la biblioteca."
          confirmTitle="Eliminar"
          cancelTitle="Cancelar"
          onConfirm={handleDeleteSong}
          onCancel={() => {
            setItemToDelete(null);
            setDeleteConfirmVisible(false);
          }}
        />
      )}

      {metadataVisible && (
        <MetadataModal
          visible={metadataVisible}
          name={metadataName}
          description={metadataDescription}
          onChangeName={setMetadataName}
          onChangeDescription={setMetadataDescription}
          onSave={handleSaveMetadata}
          onCancel={() => setMetadataVisible(false)}
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
  back: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
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
  metaCard: {
    marginBottom: tokens.spacing.lg,
  },
  metaTitle: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.xl,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  editMetaButton: {
    alignSelf: 'flex-start',
    minWidth: 120,
    marginBottom: tokens.spacing.sm,
  },
  metaDescription: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    marginBottom: tokens.spacing.md,
  },
  metaStats: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    flexWrap: 'wrap',
    marginTop: tokens.spacing.sm,
  },
  stat: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  statMissing: {
    color: colors.dark.warning,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: tokens.spacing.xl,
  },
  addButton: {
    marginTop: tokens.spacing.md,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  modalTitle: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
    marginBottom: tokens.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  modalCancel: {
    flex: 1,
  },
  modalSave: {
    flex: 1,
    backgroundColor: colors.dark.accent,
  },
});

interface MetadataModalProps {
  visible: boolean;
  name: string;
  description: string;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function MetadataModal({
  visible,
  name,
  description,
  onChangeName,
  onChangeDescription,
  onSave,
  onCancel,
}: MetadataModalProps) {
  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Card style={styles.modalCard}>
          <Text style={styles.modalTitle}>Editar setlist</Text>
          <FormField
            label="Nombre"
            value={name}
            onChangeText={onChangeName}
            placeholder="Nombre de la setlist"
          />
          <FormField
            label="Descripción"
            value={description}
            onChangeText={onChangeDescription}
            placeholder="Descripción opcional"
            multiline
            numberOfLines={3}
          />
          <View style={styles.modalButtons}>
            <LargeButton title="Cancelar" style={styles.modalCancel} onPress={onCancel} />
            <LargeButton title="Guardar" style={styles.modalSave} light onPress={onSave} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
