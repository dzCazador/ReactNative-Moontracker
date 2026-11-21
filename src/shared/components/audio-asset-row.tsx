import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import type { AudioAsset } from '@/data/models';

interface AudioAssetRowProps {
  asset: AudioAsset;
  onPress: (asset: AudioAsset) => void;
  onRelink?: (asset: AudioAsset) => void;
  selected?: boolean;
  style?: ViewStyle;
}

export function AudioAssetRow({
  asset,
  onPress,
  onRelink,
  selected = false,
  style,
}: AudioAssetRowProps) {
  const typeLabel = asset.type === 'MAIN_TRACK' ? 'Pista principal' : 'Loop intermedio';
  const duration = asset.duration_ms
    ? `${Math.floor(asset.duration_ms / 60000)}:${String(
        Math.floor((asset.duration_ms % 60000) / 1000)
      ).padStart(2, '0')}`
    : '--:--';
  const size =
    asset.file_size_bytes != null ? `${(asset.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : '--';
  const origin = asset.source_url ? 'Descarga' : 'Local';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected && styles.selected,
        asset.is_missing && styles.missing,
        style,
      ]}
      onPress={() => onPress(asset)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${asset.display_name}, ${typeLabel}, ${origin}`}
    >
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{asset.type === 'MAIN_TRACK' ? 'M' : 'L'}</Text>
      </View>
      <View style={styles.textArea}>
        <Text style={styles.title} numberOfLines={1}>
          {asset.display_name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {typeLabel} • {origin} • {duration} • {size}
        </Text>
      </View>
      {asset.is_missing && (
        <Text style={styles.missingText}>Faltante</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: colors.dark.surfaceElevated,
    minHeight: 52,
  },
  selected: {
    borderColor: colors.dark.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
  },
  missing: {
    borderColor: colors.dark.warning,
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm,
    flexShrink: 0,
  },
  typeBadgeText: {
    color: colors.dark.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  missingText: {
    color: colors.dark.warning,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: tokens.spacing.sm,
    flexShrink: 0,
  },
});
