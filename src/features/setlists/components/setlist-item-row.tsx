import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import type { SetlistItemWithAudio, AudioAsset } from '@/data/models';
import { resolveEffectiveIntermediateAudio } from '@/lib/intermediate-resolution';

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

  // Texto de intermedio compacto
  const loopText = (() => {
    if (resolution.reason === 'SILENCE') return 'Sin intermedio';
    if (resolution.reason === 'CUSTOM') return 'Intermedio propio';
    if (resolution.reason === 'SETLIST_DEFAULT') return 'Intermedio setlist';
    if (resolution.reason === 'GLOBAL_DEFAULT') return 'Intermedio global';
    return 'Sin intermedio';
  })();

  const loopWarning = resolution.audio ? resolution.audio.is_missing : false;

  return (
    <TouchableOpacity
      style={[styles.container, style, mainMissing && styles.mainMissing]}
      onPress={() => onEdit(item)}
      onLongPress={() => onEdit(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Tema ${position}: ${item.song_title}`}
    >
      {/* Fila 1: Número + Icono + Título + Acciones */}
      <View style={styles.rowTop}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{position}</Text>
        </View>

        <View style={styles.musicIcon}>
          <Text style={styles.musicIconText}>♪</Text>
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>
            {item.song_title}
          </Text>
          {item.artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {position > 1 && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => onMoveUp(item.id)}
              accessibilityLabel="Subir"
            >
              <Text style={styles.iconBtnText}>▲</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onMoveDown(item.id)}
            accessibilityLabel="Bajar"
          >
            <Text style={styles.iconBtnText}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete(item.id)}
            accessibilityLabel="Eliminar"
          >
            <Text style={styles.deleteIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fila 2: Info del intermedio */}
      <View style={styles.rowBottom}>
        <View style={styles.loopBadge}>
          <Text style={[styles.loopText, loopWarning && styles.loopWarn]}>
            {loopWarning ? '⚠ ' : ''}{loopText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: colors.dark.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border,
  },
  mainMissing: {
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  rowBottom: {
    marginTop: 2,
    paddingLeft: 62,
  },
  positionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dark.border,
    flexShrink: 0,
  },
  positionText: {
    color: colors.dark.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  musicIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  musicIconText: {
    color: colors.dark.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  artist: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 2,
  },
  iconBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  iconBtnText: {
    color: colors.dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteIcon: {
    color: colors.dark.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  loopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loopText: {
    color: colors.dark.textMuted,
    fontSize: 12,
  },
  loopWarn: {
    color: colors.dark.warning,
    fontWeight: '600',
  },
});
