import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { AppSettingsRepository } from '@/data/db/repositories/app-settings-repository';
import { AudioAssetRepository } from '@/data/db/repositories/audio-asset-repository';
import type { AudioAsset } from '@/data/models';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from '@/shared/components/large-button';
import { Card } from '@/shared/components/card';
import { Skeleton } from '@/shared/components/skeleton';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { AssetPickerModal } from '@/shared/components/asset-picker-modal';
import { FadeInput } from '@/shared/components/fade-input';

const SETTINGS = {
  GLOBAL_INTERMEDIATE_AUDIO_ID: 'settings:global_intermediate_audio_id',
  DEFAULT_FADE_IN_MS: 'settings:default_fade_in_ms',
  DEFAULT_FADE_OUT_MS: 'settings:default_fade_out_ms',
  LIVE_MODE_LOCK: 'settings:live_mode_lock',
  AUDIO_DEBUG_LOGS: 'settings:audio_debug_logs',
} as const;

export default function SettingsScreen() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [globalIntermediateAudioId, setGlobalIntermediateAudioId] = useState<string | null>(null);
  const [defaultFadeInMs, setDefaultFadeInMs] = useState<number | null>(null);
  const [defaultFadeOutMs, setDefaultFadeOutMs] = useState<number | null>(null);
  const [liveModeLock, setLiveModeLock] = useState(false);
  const [audioDebugLogs, setAudioDebugLogs] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);

  const settingsRepo = useMemo(() => new AppSettingsRepository(), []);
  const assetRepo = useMemo(() => new AudioAssetRepository(), []);

  const globalIntermediateAsset = assets.find((a) => a.id === globalIntermediateAudioId) ?? null;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsData, globalIntermediate, fadeIn, fadeOut, lock, debug] = await Promise.all([
        assetRepo.list({ includeMissing: true }),
        settingsRepo.getSetting<string | null>(SETTINGS.GLOBAL_INTERMEDIATE_AUDIO_ID),
        settingsRepo.getSetting<number>(SETTINGS.DEFAULT_FADE_IN_MS),
        settingsRepo.getSetting<number>(SETTINGS.DEFAULT_FADE_OUT_MS),
        settingsRepo.getSetting<boolean>(SETTINGS.LIVE_MODE_LOCK),
        settingsRepo.getSetting<boolean>(SETTINGS.AUDIO_DEBUG_LOGS),
      ]);

      setAssets(assetsData);
      setGlobalIntermediateAudioId(globalIntermediate ?? null);
      setDefaultFadeInMs(fadeIn ?? null);
      setDefaultFadeOutMs(fadeOut ?? null);
      setLiveModeLock(Boolean(lock));
      setAudioDebugLogs(Boolean(debug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar los ajustes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: string, value: unknown) => {
    try {
      await settingsRepo.setSetting(key, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ajuste');
    }
  };

  const handleSelectGlobalIntermediate = () => {
    setPickerVisible(true);
  };

  const handleIntermediateSelected = (asset: AudioAsset) => {
    setGlobalIntermediateAudioId(asset.id);
    void saveSetting(SETTINGS.GLOBAL_INTERMEDIATE_AUDIO_ID, asset.id);
    setPickerVisible(false);
  };

  const handleRemoveGlobalIntermediate = () => {
    setRemoveConfirmVisible(true);
  };

  const confirmRemoveGlobalIntermediate = async () => {
    setGlobalIntermediateAudioId(null);
    await saveSetting(SETTINGS.GLOBAL_INTERMEDIATE_AUDIO_ID, null);
    setRemoveConfirmVisible(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.sub}>
          Configuración global de la aplicación. Los cambios se guardan automáticamente.
        </Text>
      </View>

      {error && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Loop intermedio predeterminado</Text>
        <Text style={styles.sectionHint}>
          Se usa cuando una canción está configurada con &quot;Predeterminado global&quot;.
        </Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {globalIntermediateAsset
                ? `Predeterminado: ${globalIntermediateAsset.display_name}`
                : 'Ninguno'}
            </Text>
            <Text style={styles.settingValue}>
              {globalIntermediateAsset?.type === 'INTERMEDIATE_LOOP'
                ? 'Loop intermedio'
                : globalIntermediateAsset
                  ? 'Audio no válido como intermedio'
                  : '—'}
            </Text>
          </View>
          <LargeButton
            title={globalIntermediateAsset ? 'Cambiar' : 'Seleccionar'}
            style={styles.selectButton}
            onPress={handleSelectGlobalIntermediate}
          />
          {globalIntermediateAsset && (
            <LargeButton
              title="Quitar"
              style={[styles.selectButton, styles.removeButton]}
              onPress={handleRemoveGlobalIntermediate}
            />
          )}
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Duraciones predeterminadas de fade</Text>
        <Text style={styles.sectionHint}>
          Se aplican a las canciones que no tienen anulación de fade configurada.
        </Text>
        <FadeInput
          label="Fade in predeterminado (ms)"
          value={defaultFadeInMs}
          onChange={(value) => void saveSetting(SETTINGS.DEFAULT_FADE_IN_MS, value ?? 0)}
        />
        <FadeInput
          label="Fade out predeterminado (ms)"
          value={defaultFadeOutMs}
          onChange={(value) => void saveSetting(SETTINGS.DEFAULT_FADE_OUT_MS, value ?? 0)}
        />
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Modo en vivo</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Bloquear modo en vivo</Text>
          <Switch
            value={liveModeLock}
            onValueChange={(value) => {
              setLiveModeLock(value);
              void saveSetting(SETTINGS.LIVE_MODE_LOCK, value);
            }}
            trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
            thumbColor={liveModeLock ? colors.dark.accent : colors.dark.textSecondary}
          />
        </View>
        <Text style={styles.toggleHint}>
          Cuando está bloqueado, se requiere confirmación antes de iniciar o finalizar una
          actuación.
        </Text>
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Depuración</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Logs de depuración de audio</Text>
          <Switch
            value={audioDebugLogs}
            onValueChange={(value) => {
              setAudioDebugLogs(value);
              void saveSetting(SETTINGS.AUDIO_DEBUG_LOGS, value);
            }}
            trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
            thumbColor={audioDebugLogs ? colors.dark.accent : colors.dark.textSecondary}
          />
        </View>
        <Text style={styles.toggleHint}>
          Solo visible en entorno de desarrollo. Registra acciones de importación, descarga y
          asignación de audio.
        </Text>
      </Card>

      {pickerVisible && (
        <AssetPickerModal
          visible={pickerVisible}
          title="Elegir loop intermedio predeterminado"
          type="INTERMEDIATE_LOOP"
          assets={assets}
          onSelect={handleIntermediateSelected}
          onCancel={() => setPickerVisible(false)}
          onImport={() => setPickerVisible(false)}
        />
      )}

      {removeConfirmVisible && (
        <ConfirmDialog
          visible={removeConfirmVisible}
          title="Quitar predeterminado"
          message="¿Quitar el loop intermedio predeterminado global? Las canciones que lo usen resolverán a silencio hasta que se configure uno nuevo."
          confirmTitle="Quitar"
          cancelTitle="Cancelar"
          onConfirm={confirmRemoveGlobalIntermediate}
          onCancel={() => setRemoveConfirmVisible(false)}
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
  sectionCard: {
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  sectionHint: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    marginBottom: tokens.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  settingInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingLabel: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  settingValue: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: 2,
  },
  selectButton: {
    flexShrink: 0,
    minWidth: 110,
  },
  removeButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
    marginLeft: tokens.spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  toggleHint: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: tokens.spacing.xs,
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
