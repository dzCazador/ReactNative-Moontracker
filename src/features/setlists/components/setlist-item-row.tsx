import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import type { SetlistItemWithAudio, AudioAsset } from '@/data/models';
import { resolveEffectiveIntermediateAudio } from '@/lib/intermediate-resolution';
import { LargeButton } from '@/shared/components/large-button';

interface SetlistItemRowProps {
  item: SetlistItemWithAudio;
  position: number;
  setlistDefaultAudioId: string | null;
  globalDefaultAudioId: string | null;
  assetsById: Record<string, AudioAsset>;
  onEdit: (item: SetlistItemWithAudio) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  style?: ViewStyle;
}

export function SetlistItemRow({
  item,
  position,
  setlistDefaultAudioId,
  globalDefaultAudioId,
  assetsById,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  style,
}: SetlistItemRowProps) {
  const resolution = resolveEffectiveIntermediateAudio({
    item: {
      intermediate_mode: item.intermediate_mode,
      intermediate_audio_id: item.intermediate_audio_id,
    },
    setlistDefaultAudioId,
    globalDefaultAudioId,
    assetsById,
  });

  const mainMissing = item.main_audio?.is_missing ?? true;
  const intermediateMissing =
    resolution.audio != null ? resolution.audio.is_missing : resolution.reason === 'NONE';

  const intermediateLabel = ((): string => {
    if (resolution.reason === 'SILENCE') return 'Sin intermedio';
    if (resolution.reason === 'CUSTOM')
      return `Intermedio: ${resolution.audio?.display_name ?? '—'}`;
    if (resolution.reason === 'SETLIST_DEFAULT')
      return `Predeterminado setlist: ${resolution.audio?.display_name ?? '—'}`;
    if (resolution.reason === 'GLOBAL_DEFAULT')
      return `Predeterminado global: ${resolution.audio?.display_name ?? '—'}`;
    return 'Sin intermedio configurado';
  })();

  const mainLabel = item.main_audio?.display_name ?? 'Pista principal faltante';

  return (
    <TouchableOpacity
      style={[styles.container, style, mainMissing && styles.mainMissing]}
      onPress={() => onEdit(item)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`${item.song_title}, posición ${position}, ${mainLabel}`}
    >
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{position}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.song_title}
        </Text>
        <View style={styles.metaRow}>
          {item.artist && <Text style={styles.meta}>{item.artist}</Text>}
          <Text style={[styles.meta, styles.metaMain]}>🎵 {mainLabel}</Text>
          <Text style={[styles.meta, resolution.audio == null && styles.metaWarn]}>
            {intermediateMissing ? '⚠' : '•'} {intermediateLabel}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {position > 1 && (
          <LargeButton
            title="▲"
            style={styles.moveButton}
            onPress={() => onMoveUp(item.id)}
            accessibilityLabel={`Subir ${item.song_title}`}
          />
        )}
        <LargeButton
          title="▼"
          style={styles.moveButton}
          onPress={() => onMoveDown(item.id)}
          accessibilityLabel={`Bajar ${item.song_title}`}
        />
        <LargeButton
          title="Editar"
          style={[styles.actionButton, { marginLeft: 4 }]}
          onPress={() => onEdit(item)}
        />
        <LargeButton
          title="Eliminar"
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(item.id)}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: colors.dark.surfaceElevated,
    minHeight: tokens.touchTarget.comfortable,
    gap: tokens.spacing.md,
  },
  mainMissing: {
    borderColor: colors.dark.warning,
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  positionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dark.border,
    flexShrink: 0,
  },
  positionText: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  meta: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
  },
  metaMain: {
    color: colors.dark.textSecondary,
    fontWeight: '600',
  },
  metaWarn: {
    color: colors.dark.warning,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: tokens.spacing.xs,
  },
  moveButton: {
    width: 44,
    minWidth: 44,
    minHeight: tokens.touchTarget.min,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  actionButton: {
    minHeight: tokens.touchTarget.min,
    minWidth: 60,
    paddingHorizontal: tokens.spacing.sm,
  },
  deleteButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
  },
});
