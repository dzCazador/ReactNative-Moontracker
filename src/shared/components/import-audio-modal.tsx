import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import {
  pickAudioFileAsync,
  importAudioFileAsync,
  downloadAudioFromUrlAsync,
  type ImportedAudioResult,
} from '@/services/filesystem';
import { logger } from '@/lib/logger';
import { ImportError, DuplicateAudioError } from '@/lib/errors';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { FormField } from './form-field';
import { LargeButton } from './large-button';

interface ImportAudioModalProps {
  visible: boolean;
  title?: string;
  onImported: (audio: { id: string; display_name: string; type: string }) => void;
  onCancel: () => void;
  style?: ViewStyle;
}

type ImportTab = 'local' | 'url';

export function ImportAudioModal({
  visible,
  title = 'Importar audio',
  onImported,
  onCancel,
  style,
}: ImportAudioModalProps) {
  const [tab, setTab] = useState<ImportTab>('local');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [sourceType, setSourceType] = useState<'MAIN_TRACK' | 'INTERMEDIATE_LOOP'>('MAIN_TRACK');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ImportedAudioResult | null>(null);

  const handlePickLocal = async () => {
    setError(null);
    setSuccess(null);
    setImporting(true);
    try {
      const assets = await pickAudioFileAsync({ multiple: false });
      if (assets.length === 0) {
        setImporting(false);
        return;
      }
      const asset = assets[0];
      if (!asset.uri || !asset.name) {
        throw new ImportError('No se pudo leer el archivo seleccionado', { uri: asset.uri });
      }

      setProgress({ loaded: asset.size ?? 0, total: asset.size ?? 0 });

      const result = await importAudioFileAsync({
        uri: asset.uri,
        originalFilename: asset.name,
        mimeType: asset.mimeType ?? null,
        size: asset.size ?? null,
        source: sourceType,
        onDuplicate: 'reuse',
      });

      setProgress(null);
      setSuccess({ audio: result.audio, reused: false, fileCopied: true });
      setImporting(false);
      onImported({
        id: result.audio.id,
        display_name: result.audio.display_name,
        type: result.audio.type,
      });
    } catch (err) {
      setImporting(false);
      setProgress(null);
      setError(formatError(err));
      logger.error('[ImportAudioModal] import failed', { error: err });
    }
  };

  const handleDownloadUrl = async () => {
    setError(null);
    setSuccess(null);
    setImporting(true);
    try {
      const parsed = new URL(url);
      if (!parsed.protocol || !parsed.host) {
        throw new ImportError('URL inválida', { url });
      }

      let loaded = 0;
      let total = null;
      const result = await downloadAudioFromUrlAsync({
        url,
        fileName: fileName || undefined,
        source: sourceType,
        onProgress: (p) => {
          loaded = p.bytesWritten;
          total = p.totalBytes ?? null;
          setProgress({ loaded, total: total ?? 0 });
        },
      });

      setProgress(null);
      setSuccess({ audio: result.audio, reused: false, fileCopied: true });
      setImporting(false);
      onImported({
        id: result.audio.id,
        display_name: result.audio.display_name,
        type: result.audio.type,
      });
    } catch (err) {
      setImporting(false);
      setProgress(null);
      setError(formatError(err));
      logger.error('[ImportAudioModal] download failed', { error: err });
    }
  };

  const handleCloseSuccess = () => {
    setSuccess(null);
    onCancel();
  };

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

          <View style={styles.tabs}>
            <TabButton
              title="Archivo local"
              active={tab === 'local'}
              onPress={() => setTab('local')}
            />
            <TabButton
              title="Descargar desde enlace"
              active={tab === 'url'}
              onPress={() => setTab('url')}
            />
          </View>

          {tab === 'local' && (
            <View style={styles.stepsGroup}>
              <Text style={styles.sectionTitle}>Seleccionar archivo</Text>
              <Text style={styles.sectionHint}>
                Formatos admitidos: .wav, .ogg, .flac, .mp3, .m4a, .aac
              </Text>
              <View style={styles.sourceSelector}>
                <Text style={styles.sectionTitle}>Tipo de audio</Text>
                <ModeToggle
                  value={sourceType}
                  onChange={setSourceType}
                  mainLabel="Pista principal"
                  loopLabel="Loop intermedio"
                />
              </View>
              <LargeButton
                title="Seleccionar archivo de audio"
                style={styles.pickButton}
                onPress={handlePickLocal}
                disabled={importing}
              />
            </View>
          )}

          {tab === 'url' && (
            <View style={styles.stepsGroup}>
              <Text style={styles.sectionTitle}>Descargar desde enlace</Text>
              <Text style={styles.sectionHint}>
                Google Drive, Mega o cualquier enlace directo al archivo de audio.
              </Text>
              <FormField
                label="URL del audio"
                value={url}
                onChangeText={setUrl}
                placeholder="https://ejemplo.com/audio.wav"
                error={tab === 'url' ? (error ?? undefined) : undefined}
              />
              <FormField
                label="Nombre del archivo (opcional)"
                value={fileName}
                onChangeText={setFileName}
                placeholder="mi-pista.wav"
              />
              <View style={styles.sourceSelector}>
                <Text style={styles.sectionTitle}>Tipo de audio</Text>
                <ModeToggle
                  value={sourceType}
                  onChange={setSourceType}
                  mainLabel="Pista principal"
                  loopLabel="Loop intermedio"
                />
              </View>
              <LargeButton
                title="Descargar audio"
                style={styles.downloadButton}
                onPress={handleDownloadUrl}
                disabled={importing || !url.trim()}
              />
            </View>
          )}

          {progress && (
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>
                {tab === 'local' ? 'Importando…' : 'Descargando…'}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        progress.total > 0
                          ? Math.min(100, (progress.loaded / progress.total) * 100)
                          : 0,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {formatBytes(progress.loaded)} /
                {progress.total > 0 ? formatBytes(progress.total) : '?'}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successCard}>
              <Text style={styles.successText}>✔ Importado: {success.audio.display_name}</Text>
              <LargeButton title="Listo" style={styles.doneButton} onPress={handleCloseSuccess} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatError(error: unknown): string {
  if (error instanceof ImportError) {
    return error.message;
  }
  if (error instanceof DuplicateAudioError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error inesperado al importar el audio.';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

interface TabButtonProps {
  title: string;
  active: boolean;
  onPress: () => void;
}
function TabButton({ title, active, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

interface ModeToggleProps {
  value: 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';
  onChange: (value: 'MAIN_TRACK' | 'INTERMEDIATE_LOOP') => void;
  mainLabel: string;
  loopLabel: string;
}
function ModeToggle({ value, onChange, mainLabel, loopLabel }: ModeToggleProps) {
  return (
    <View style={styles.modeToggle}>
      <TouchableOpacity
        style={[styles.modeButton, value === 'MAIN_TRACK' && styles.modeActive]}
        onPress={() => onChange('MAIN_TRACK')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.modeText, value === 'MAIN_TRACK' && styles.modeTextActive]}>
          {mainLabel}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeButton, value === 'INTERMEDIATE_LOOP' && styles.modeActive]}
        onPress={() => onChange('INTERMEDIATE_LOOP')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.modeText, value === 'INTERMEDIATE_LOOP' && styles.modeTextActive]}>
          {loopLabel}
        </Text>
      </TouchableOpacity>
    </View>
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
    maxHeight: '90%',
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
  },
  tabActive: {
    borderColor: colors.dark.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
  },
  tabText: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.dark.accent,
  },
  stepsGroup: {
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  pickButton: {
    minHeight: tokens.touchTarget.comfortable,
  },
  downloadButton: {
    minHeight: tokens.touchTarget.comfortable,
  },
  sourceSelector: {
    marginTop: tokens.spacing.sm,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
  },
  modeActive: {
    borderColor: colors.dark.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
  },
  modeText: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.dark.accent,
  },
  progressCard: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.dark.accent,
  },
  progressLabel: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },
  progressText: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
  },
  errorCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  errorText: {
    color: colors.dark.danger,
    fontSize: tokens.fontSize.sm,
  },
  successCard: {
    backgroundColor: 'rgba(74, 222, 128, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.success,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    alignItems: 'center',
  },
  successText: {
    color: colors.dark.success,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  doneButton: {
    minHeight: tokens.touchTarget.comfortable,
    marginTop: tokens.spacing.sm,
  },
});
