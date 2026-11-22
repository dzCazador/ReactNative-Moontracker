/**
 * Pantalla de Modo En Vivo - Escenario
 *
 * Pantalla de actuación con alto contraste, controles grandes y protecciones
 * anti-accidentes para el baterista.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, BackHandler, SafeAreaView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { SetlistRepository } from '@/data/db/repositories/setlist-repository';
import { SetlistItemRepository } from '@/data/db/repositories/setlist-item-repository';
import { AudioAssetRepository } from '@/data/db/repositories/audio-asset-repository';
import { AppSettingsRepository } from '@/data/db/repositories/app-settings-repository';
import type { SetlistWithCounts, SetlistItemWithAudio, AudioAsset } from '@/data/models';
import { useLivePlayback } from '@/features/audio/hooks/use-audio-engine';
import type { PlaybackPhase } from '@/features/audio/types';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { useLiveModeStore } from '@/lib/live-mode-store';

type RootStackParamList = {
  Admin: undefined;
  Library: undefined;
  Setlists: undefined;
  SetlistDetail: { setlistId: string };
  Settings: undefined;
  Live: undefined;
};

const GLOBAL_INTERMEDIATE_SETTING_KEY = 'settings:global_intermediate_audio_id';

export default function LiveScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isActive = useLiveModeStore((s) => s.isActive);
  const setActive = useLiveModeStore((s) => s.setActive);
  
  const [setlists, setSetlists] = useState<SetlistWithCounts[]>([]);
  const [selectedSetlist, setSelectedSetlist] = useState<SetlistWithCounts | null>(null);
  const [items, setItems] = useState<SetlistItemWithAudio[]>([]);
  const [globalDefaultAudioId, setGlobalDefaultAudioId] = useState<string | null>(null);

  const {
    status,
    phase,
    error,
    isEngineReady,
    loadSetlist,
    triggerNext,
    stop,
    seek,
  } = useLivePlayback();

  const [seekLocked, setSeekLocked] = useState(true);
  const [barWidth, setBarWidth] = useState(0);

  const handleSeek = useCallback((e: any) => {
    if (seekLocked || !status.durationSec || status.durationSec <= 0) return;
    const locationX = e.nativeEvent.locationX;
    if (barWidth <= 0) return;
    const fraction = Math.max(0, Math.min(1, locationX / barWidth));
    const positionSec = fraction * status.durationSec;
    seek('A', positionSec);
  }, [seekLocked, status.durationSec, barWidth, seek]);

  const progress = status.durationSec && status.durationSec > 0
    ? (status.positionSec / status.durationSec) * 100
    : 0;

  // Activar wake lock
  useKeepAwake();

  const setlistRepo = new SetlistRepository();
  const itemRepo = new SetlistItemRepository();
  const settingsRepo = new AppSettingsRepository();

  useEffect(() => {
    loadSetlists();
  }, []);

  const loadSetlists = useCallback(async () => {
    try {
      const data = await setlistRepo.list();
      setSetlists(data);
    } catch (err) {
      console.error('Error cargando setlists:', err);
    }
  }, []);

  const handleStartPerformance = useCallback(
    async (setlist: SetlistWithCounts) => {
      try {
        const live = await itemRepo.loadSetlistForLive(setlist.id);
        const globalDefault = await settingsRepo.getSetting<string | null>(GLOBAL_INTERMEDIATE_SETTING_KEY);
        
        // Load the global default audio asset if configured
        let globalDefaultAudio: AudioAsset | null = null;
        if (globalDefault) {
          globalDefaultAudio = await new AudioAssetRepository().getById(globalDefault);
        }
        
        setSelectedSetlist(setlist);
        setItems(live.items);
        setGlobalDefaultAudioId(globalDefault ?? null);
        isStoppingRef.current = false; // Reset stopping flag
        setActive(true);

        // Cargar la setlist en el controlador
        await loadSetlist(
          setlist,
          live.items,
          globalDefault ?? undefined,
          globalDefaultAudio ?? undefined
        );
      } catch (err) {
        Alert.alert('Error', 'No se pudo iniciar la actuación');
        console.error(err);
      }
    },
    [loadSetlist, setActive]
  );

  const isStoppingRef = useRef(false);

  const handleEndPerformance = useCallback(() => {
    if (isStoppingRef.current) return;
    Alert.alert(
      'Finalizar actuación',
      '¿Seguro que querés salir del Modo En Vivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            if (isStoppingRef.current) return;
            isStoppingRef.current = true;
            await stop();
            isStoppingRef.current = false;
            setActive(false);
            setSelectedSetlist(null);
            setItems([]);
          },
        },
      ]
    );
  }, [stop, setActive]);

  const handleEmergencyStop = useCallback(() => {
    if (isStoppingRef.current) return;
    Alert.alert(
      'Detener reproducción',
      '¿Seguro que querés detener la actuación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Detener',
          style: 'destructive',
          onPress: async () => {
            if (isStoppingRef.current) return;
            isStoppingRef.current = true;
            await stop();
            isStoppingRef.current = false;
          },
        },
      ]
    );
  }, [stop]);

  // Intercept back button
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isActive) {
        handleEndPerformance();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [isActive, handleEndPerformance]);

  const handleTriggerNext = useCallback(() => {
    if (phase === 'playing-main' || phase === 'fading-out') {
      return; // Prevenir doble disparo
    }
    triggerNext();
  }, [phase, triggerNext]);

  if (!isActive || !selectedSetlist) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Modo En Vivo</Text>
            <Text style={styles.subtitle}>Seleccioná una setlist para comenzar</Text>
          </View>

        {setlists.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay setlists disponibles</Text>
            <Text style={styles.emptyHint}>Creá una setlist primero en la sección de Setlists</Text>
          </View>
        ) : (
          <View style={styles.setlistList}>
            {setlists.map((setlist) => (
              <TouchableOpacity
                key={setlist.id}
                style={styles.setlistCard}
                onPress={() => handleStartPerformance(setlist)}
                activeOpacity={0.7}
              >
                <Text style={styles.setlistName}>{setlist.name}</Text>
                <Text style={styles.setlistMeta}>
                  {setlist.item_count} canción{setlist.item_count !== 1 ? 'es' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      </SafeAreaView>
    );
  }

  // Vista de actuación
  const currentItem = items.find((i) => i.id === status.currentItemId);
  const nextItem = items.find((i) => i.id === status.nextItemId);
  const currentIndex = items.findIndex((i) => i.id === status.currentItemId);

  const phaseLabel = getPhaseLabel(phase);
  const isTransitioning = phase === 'fading-out' || phase === 'fading-in';
  // SIGUIENTE is only available while a standby loop is running (or waiting
  // silently when no loop is configured). It is disabled during the main song.
  const canAdvance = phase === 'playing-loop' || phase === 'silent-waiting';
  const isNextDisabled = isTransitioning || !canAdvance;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Header con info de setlist */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.setlistTitle}>{selectedSetlist.name}</Text>
            <Text style={styles.songCounter}>
              {currentIndex + 1} / {items.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleEndPerformance}
            style={styles.endButton}
            activeOpacity={0.7}
          >
            <Text style={styles.endButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>

      {/* Indicador de fase */}
      <View style={[styles.phaseIndicator, isTransitioning && styles.phaseTransitioning]}>
        <Text style={styles.phaseText}>{phaseLabel}</Text>
      </View>

      {/* Canción actual / siguiente según fase */}
      <View style={styles.currentSongArea}>
        <Text style={styles.currentSongLabel}>
          {phase === 'playing-main' ? '🔊 SONANDO' :
           phase === 'prepared' || phase === 'playing-loop' ? '⏭ PRÓXIMO TEMA' :
           phase === 'idle' ? '—' :
           phase === 'error' ? '⚠ ERROR' :
           phase === 'fading-out' || phase === 'fading-in' ? '🔄 TRANSICIÓN' :
           '—'}
        </Text>
        <Text style={styles.currentSongTitle} numberOfLines={2}>
          {phase === 'playing-main'
            ? currentItem?.song_title ?? '—'
            : currentItem?.song_title ?? (status.isLastSong ? 'Fin de setlist' : '—')}
        </Text>
        {(phase === 'playing-main' ? currentItem?.artist : currentItem?.artist) && (
          <Text style={styles.artistText}>
            {phase === 'playing-main' ? currentItem?.artist : currentItem?.artist}
          </Text>
        )}
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressArea}>
        <TouchableOpacity
          style={styles.progressBar}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={handleSeek}
          activeOpacity={seekLocked ? 1 : 0.7}
          disabled={seekLocked}
        >
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </TouchableOpacity>
        <View style={styles.lockRow}>
          <TouchableOpacity
            style={styles.lockButton}
            onPress={() => setSeekLocked((prev) => !prev)}
            activeOpacity={0.6}
          >
            <Text style={styles.lockButtonText}>
              {seekLocked ? '🔒 Bloqueado — tocar para desbloquear seek' : '🔓 Desbloqueado — tocar para bloquear'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.timeText}>{formatTime(status.positionSec)}</Text>
          <Text style={[styles.timeText, styles.remainingTime]}>
            -{formatTime(Math.max(0, (status.durationSec ?? 0) - status.positionSec))}
          </Text>
          <Text style={styles.timeText}>{formatTime(status.durationSec ?? 0)}</Text>
        </View>
      </View>

      {/* Siguiente canción */}
      <View style={styles.nextSongArea}>
        <Text style={styles.nextSongLabel}>SIGUIENTE</Text>
        <Text style={styles.nextSongTitle} numberOfLines={1}>
          {nextItem?.song_title ?? (status.isLastSong ? 'Fin de setlist' : '—')}
        </Text>
      </View>

      {/* Estado del loop */}
      <View style={styles.loopStatus}>
        <Text style={styles.loopText}>
          {getLoopStatus(phase)}
        </Text>
      </View>

      {/* Botón NEXT */}
      <TouchableOpacity
        style={[styles.nextButton, isNextDisabled && styles.nextButtonDisabled]}
        onPress={handleTriggerNext}
        disabled={isNextDisabled}
        activeOpacity={0.6}
      >
        <Text style={styles.nextButtonText}>
          {phase === 'playing-main' && status.isLastSong ? 'FINALIZAR' : 'SIGUIENTE'}
        </Text>
      </TouchableOpacity>

      {/* Botón de emergencia */}
      <TouchableOpacity
        style={styles.emergencyButton}
        delayLongPress={1500}
        onLongPress={handleEmergencyStop}
      >
        <Text style={styles.emergencyText}>Mantener 1.5s para detener</Text>
      </TouchableOpacity>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity
            style={styles.errorAction}
            onPress={() => {
              if (error.actions.includes('retry')) {
                // Intentar recuperar
              } else if (error.actions.includes('skip')) {
                handleTriggerNext();
              }
            }}
          >
            <Text style={styles.errorActionText}>
              {error.actions.includes('retry') ? 'Reintentar' : 'Omitir'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </SafeAreaView>
  );
}

function getPhaseLabel(phase: PlaybackPhase): string {
  switch (phase) {
    case 'idle':
      return 'Preparando...';
    case 'prepared':
      return 'Listo';
    case 'playing-main':
      return '▶ REPRODUCIENDO';
    case 'playing-loop':
      return '⟳ LOOP INTERMEDIO';
    case 'fading-out':
      return 'Transición...';
    case 'fading-in':
      return 'Transición...';
    case 'silent-waiting':
      return 'Esperando...';
    case 'stopped':
      return 'Detenido';
    case 'error':
      return '⚠ ERROR';
    default:
      return '—';
  }
}

function getLoopStatus(phase: PlaybackPhase): string {
  if (phase === 'playing-loop' || phase === 'fading-in') {
    return '🔊 Loop activo';
  }
  if (phase === 'fading-out') {
    return '🔇 Loop saliendo';
  }
  if (phase === 'playing-main') {
    return '🎵 Canción principal';
  }
  if (phase === 'silent-waiting') {
    return '🔇 Silencio';
  }
  return '—';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.lg,
    zIndex: 1,
    minHeight: 40,
  },
  headerLeft: {
    flex: 1,
    marginRight: tokens.spacing.md,
  },
  backButton: {
    padding: tokens.spacing.sm,
  },
  backText: {
    color: colors.dark.accent,
    fontSize: tokens.fontSize.md,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.md,
  },
  setlistTitle: {
    color: '#ffffff',
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
  },
  songCounter: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.md,
    marginTop: 2,
  },
  endButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
    borderRadius: tokens.borderRadius.md,
  },
  endButtonText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.lg,
    marginBottom: tokens.spacing.sm,
  },
  emptyHint: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.md,
    textAlign: 'center',
  },
  setlistList: {
    flex: 1,
    gap: tokens.spacing.md,
  },
  setlistCard: {
    backgroundColor: colors.dark.surface,
    padding: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  setlistName: {
    color: '#ffffff',
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  setlistMeta: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
  },
  phaseIndicator: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: colors.dark.surface,
    borderRadius: tokens.borderRadius.pill,
    alignSelf: 'flex-start',
    marginBottom: tokens.spacing.lg,
  },
  phaseTransitioning: {
    backgroundColor: colors.dark.warning,
  },
  phaseText: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
  },
  currentSongArea: {
    marginBottom: tokens.spacing.lg,
  },
  currentSongLabel: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  currentSongTitle: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: tokens.spacing.xs,
  },
  artistText: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.lg,
  },
  progressArea: {
    marginBottom: tokens.spacing.lg,
  },
  progressBar: {
    height: 12,
    backgroundColor: colors.dark.surface,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.dark.accent,
  },
  lockRow: {
    marginBottom: tokens.spacing.sm,
  },
  lockButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: tokens.spacing.sm,
  },
  lockButtonText: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.xs,
  },
  timeText: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  remainingTime: {
    color: colors.dark.textSecondary,
    fontWeight: '600',
  },
  nextSongArea: {
    marginBottom: tokens.spacing.lg,
    padding: tokens.spacing.md,
    backgroundColor: colors.dark.surface,
    borderRadius: tokens.borderRadius.md,
  },
  nextSongLabel: {
    color: colors.dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  nextSongTitle: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
  },
  loopStatus: {
    marginBottom: tokens.spacing.lg,
    alignItems: 'center',
  },
  loopText: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.md,
  },
  nextButton: {
    backgroundColor: colors.dark.accent,
    paddingVertical: 24,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  emergencyButton: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  emergencyText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  errorAction: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: colors.dark.danger,
    borderRadius: tokens.borderRadius.md,
  },
  errorActionText: {
    color: '#ffffff',
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
  },
});
