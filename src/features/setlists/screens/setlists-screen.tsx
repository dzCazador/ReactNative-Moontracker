import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Modal } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/(admin)/param-list';
import { SetlistRepository } from '@/data/db/repositories/setlist-repository';
import type { SetlistWithCounts } from '@/data/models';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from '@/shared/components/large-button';
import { EmptyState } from '@/shared/components/empty-state';
import { Card } from '@/shared/components/card';
import { Skeleton } from '@/shared/components/skeleton';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { FormField } from '@/shared/components/form-field';

export default function SetlistsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [setlists, setSetlists] = useState<SetlistWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [setlistToDelete, setSetlistToDelete] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');

  const repo = useMemo(() => new SetlistRepository(), []);

  const loadSetlists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repo.list();
      setSetlists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar las setlists');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSetlists();
  }, [loadSetlists]);

  const handleCreate = async () => {
    const name = newSetlistName.trim();
    if (!name) return;
    try {
      await repo.create({ name, description: null });
      setNewSetlistName('');
      setCreateVisible(false);
      await loadSetlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la setlist');
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    try {
      await repo.duplicate(id, name);
      await loadSetlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo duplicar la setlist');
    }
  };

  const handleDelete = async () => {
    if (!setlistToDelete) return;
    try {
      await repo.delete(setlistToDelete);
      await loadSetlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la setlist');
    } finally {
      setSetlistToDelete(null);
      setDeleteConfirmVisible(false);
    }
  };

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.skeletonWrapper}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonItem}>
            <Skeleton width="45%" height={20} />
            <Skeleton style={styles.skeletonLine} width="70%" height={16} marginTop={6} />
            <Skeleton width="55%" height={14} marginTop={6} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Setlists</Text>
          <Text style={styles.sub}>Gestiona tus setlists de actuaciones.</Text>
        </View>
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <LargeButton title="Reintentar" onPress={loadSetlists} style={styles.retryButton} />
        </View>
        <LargeButton
          title="+ Nueva setlist"
          style={styles.fab}
          onPress={() => setCreateVisible(true)}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Setlists</Text>
          <Text style={styles.sub}>
            Gestiona tus setlists de actuaciones. Crea una nueva para empezar.
          </Text>
        </View>

        {setlists.length === 0 ? (
          <EmptyState
            title="No hay setlists aún"
            subtitle="Crea tu primera setlist para agregar canciones, asignar pistas principales y preparar tu actuación."
            actionTitle="Nueva setlist"
            onActionPress={() => setCreateVisible(true)}
          />
        ) : (
          <View style={styles.list}>
            {setlists.map((setlist) => {
              const updated = new Date(setlist.updated_at).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              return (
                <Card key={setlist.id} style={styles.row} elevated>
                  <View style={styles.rowContent}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {setlist.name}
                      </Text>
                      {setlist.description && (
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {setlist.description}
                        </Text>
                      )}
                      <Text style={styles.rowMeta}>
                        {setlist.item_count} canción{setlist.item_count !== 1 ? 's' : ''} •
                        {setlist.has_missing_audio ? 'Audio faltante' : 'OK'} • Actualizado {updated}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <LargeButton
                        title="Abrir"
                        style={[styles.actionButton, { marginRight: 6 }]}
                        onPress={() =>
                          navigation.navigate('SetlistDetail', { setlistId: setlist.id })
                        }
                      />
                      <LargeButton
                        title="Duplicar"
                        style={styles.actionButton}
                        onPress={() => handleDuplicate(setlist.id, `Copia de ${setlist.name}`)}
                      />
                      <LargeButton
                        title="Eliminar"
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => {
                          setSetlistToDelete(setlist.id);
                          setDeleteConfirmVisible(true);
                        }}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

      </ScrollView>

      <LargeButton
        title="+ Nueva setlist"
        style={styles.fab}
        onPress={() => setCreateVisible(true)}
      />

      {createVisible && (
        <CreateSetlistModal
          visible={createVisible}
          onCancel={() => setCreateVisible(false)}
          onCreate={handleCreate}
          name={newSetlistName}
          onChangeName={setNewSetlistName}
        />
      )}

      {deleteConfirmVisible && setlistToDelete && (
        <ConfirmDialog
          visible={deleteConfirmVisible}
          title="Eliminar setlist"
          message="¿Estás seguro de que quieres eliminar esta setlist? Se eliminarán sus canciones, pero los archivos de audio compartidos se conservarán."
          confirmTitle="Eliminar"
          cancelTitle="Cancelar"
          destructive
          onConfirm={handleDelete}
          onCancel={() => {
            setSetlistToDelete(null);
            setDeleteConfirmVisible(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  content: {
    padding: tokens.spacing.md,
    paddingBottom: 160,
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
  list: {
    gap: tokens.spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: tokens.spacing.lg,
    left: tokens.spacing.lg,
    minWidth: 140,
    backgroundColor: colors.dark.accent,
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
  rowTitle: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
  },
  rowSub: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    marginTop: 2,
  },
  rowMeta: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: tokens.spacing.xs,
  },
  actionButton: {
    minHeight: tokens.touchTarget.min,
    minWidth: 70,
    paddingHorizontal: tokens.spacing.sm,
  },
  deleteButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
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
  modalCreate: {
    flex: 1,
  },
});

interface CreateSetlistModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: () => void;
  name: string;
  onChangeName: (value: string) => void;
}

function CreateSetlistModal({
  visible,
  onCancel,
  onCreate,
  name,
  onChangeName,
}: CreateSetlistModalProps) {
  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Nueva setlist</Text>
          <FormField
            label="Nombre"
            value={name}
            onChangeText={onChangeName}
            placeholder="Ej. Concierto de verano"
          />
          <View style={styles.modalButtons}>
            <LargeButton title="Cancelar" style={styles.modalCancel} onPress={onCancel} />
            <LargeButton title="Crear" style={styles.modalCreate} onPress={onCreate} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
