/**
 * Modal para importar múltiples audios por lotes desde URLs.
 * Acepta URLs de Google Drive, Mega o enlaces directos.
 * Procesa cada URL secuencialmente con feedback de progreso.
 */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from './large-button';
import { downloadAudioFromUrlAsync } from '@/services/filesystem/audio-downloader';
import { readAudioMetadata } from '@/lib/id3-metadata';
import { logger } from '@/lib/logger';

interface BatchImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onImported: (audio: { id: string; display_name: string; type: string }) => void;
}

interface ImportResult {
  url: string;
  success: boolean;
  error?: string;
  audioId?: string;
}

export function BatchImportModal({ visible, onCancel, onImported }: BatchImportModalProps) {
  const [urlsText, setUrlsText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);

  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.startsWith('http'));
  };

  const normalizeDriveUrl = (url: string): string => {
    // Convertir URLs de Drive a formato directo
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    }
    const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    }
    return url;
  };

  const handleBatchImport = async () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: urls.length });
    setResults([]);

    const newResults: ImportResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const normalizedUrl = url.includes('drive.google.com') ? normalizeDriveUrl(url) : url;

      try {
        const fileName = `batch_${Date.now()}_${i}`;
        const result = await downloadAudioFromUrlAsync({
          url: normalizedUrl,
          fileName,
          source: 'MAIN_TRACK',
          onProgress: (p) => {
            // Actualizar progreso de descarga individual si es necesario
          },
        });

        // Intentar leer metadatos ID3
        try {
          const metadata = await readAudioMetadata(result.audio.internal_uri);
          if (metadata) {
            logger.info('[batch-import] metadatos ID3 leídos', { metadata });
          }
        } catch (err) {
          logger.warn('[batch-import] error leyendo ID3', { err });
        }

        newResults.push({
          url,
          success: true,
          audioId: result.audio.id,
        });

        onImported({
          id: result.audio.id,
          display_name: result.audio.display_name,
          type: result.audio.type,
        });

        setProgress({ current: i + 1, total: urls.length });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        newResults.push({ url, success: false, error: errorMsg });
        setProgress({ current: i + 1, total: urls.length });
      }
    }

    setResults(newResults);
    setIsProcessing(false);
  };

  const handleClose = () => {
    setUrlsText('');
    setProgress({ current: 0, total: 0 });
    setResults([]);
    onCancel();
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Modal visible={visible} transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Importar por lotes</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.close}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            {results.length === 0 ? (
              <>
                <Text style={styles.subtitle}>
                  Pega las URLs de los audios, una por línea. Soporta Google Drive, Mega y enlaces directos.
                </Text>

                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={8}
                  placeholder="https://drive.google.com/file/d/...\nhttps://mega.nz/file/...\nhttps://ejemplo.com/audio.mp3"
                  placeholderTextColor={colors.dark.textMuted}
                  value={urlsText}
                  onChangeText={setUrlsText}
                  editable={!isProcessing}
                  textAlignVertical="top"
                />

                <View style={styles.buttonRow}>
                  <LargeButton title="Cancelar" style={styles.cancelBtn} onPress={handleClose} />
                  <LargeButton
                    title={isProcessing ? `Procesando ${progress.current}/${progress.total}` : 'Importar'}
                    style={[styles.importBtn, isProcessing && styles.disabledBtn]}
                    light
                    onPress={handleBatchImport}
                    disabled={isProcessing || parseUrls(urlsText).length === 0}
                  />
                </View>
              </>
            ) : (
              <ScrollView style={styles.resultsList}>
                <Text style={styles.summary}>
                  {successCount} importados, {failCount} fallidos
                </Text>
                {results.map((r, i) => (
                  <View key={i} style={styles.resultItem}>
                    <Text style={r.success ? styles.successIcon : styles.failIcon}>
                      {r.success ? '✓' : '✗'}
                    </Text>
                    <View style={styles.resultText}>
                      <Text style={styles.resultUrl} numberOfLines={1}>
                        {r.url}
                      </Text>
                      {r.error && <Text style={styles.errorText}>{r.error}</Text>}
                    </View>
                  </View>
                ))}
                <LargeButton title="Cerrar" style={styles.importBtn} light onPress={handleClose} />
              </ScrollView>
            )}
          </View>
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
    maxWidth: 500,
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
    fontSize: tokens.fontSize.sm,
    marginBottom: tokens.spacing.md,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    color: colors.dark.text,
    fontSize: tokens.fontSize.sm,
    minHeight: 120,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  cancelBtn: {
    flex: 1,
  },
  importBtn: {
    flex: 2,
    backgroundColor: colors.dark.accent,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  resultsList: {
    maxHeight: 400,
  },
  summary: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
    marginBottom: tokens.spacing.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border,
  },
  successIcon: {
    color: colors.dark.success,
    fontSize: 18,
    fontWeight: '700',
    marginRight: tokens.spacing.sm,
  },
  failIcon: {
    color: colors.dark.danger,
    fontSize: 18,
    fontWeight: '700',
    marginRight: tokens.spacing.sm,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultUrl: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.sm,
  },
  errorText: {
    color: colors.dark.danger,
    fontSize: 11,
    marginTop: 2,
  },
});
