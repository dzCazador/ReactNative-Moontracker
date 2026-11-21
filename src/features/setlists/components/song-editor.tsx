import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AudioAsset, SetlistItemWithAudio, IntermediateMode } from '@/data/models';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';
import { LargeButton } from '@/shared/components/large-button';
import { Card } from '@/shared/components/card';
import { FormField } from '@/shared/components/form-field';
import { IntermediateModeSelector } from '@/shared/components/intermediate-mode-selector';
import { FadeInput, MAX_FADE_MS } from '@/shared/components/fade-input';
import { AssetPickerModal } from '@/shared/components/asset-picker-modal';

interface SongEditorProps {
  visible: boolean;
  setlistId: string;
  item?: SetlistItemWithAudio | null;
  mainAssets: AudioAsset[];
  intermediateAssets: AudioAsset[];
  onSave: (input: {
    song_title: string;
    artist: string | null;
    notes: string | null;
    main_audio_id: string;
    intermediate_mode: IntermediateMode;
    intermediate_audio_id: string | null;
    fade_in_loop_ms: number | null;
    fade_out_loop_ms: number | null;
  }) => void;
  onCancel: () => void;
}

export function SongEditor({
  visible,
  setlistId,
  item,
  mainAssets,
  intermediateAssets,
  onSave,
  onCancel,
}: SongEditorProps) {
  const isNew = !item;

  const [songTitle, setSongTitle] = useState(item?.song_title ?? '');
  const [artist, setArtist] = useState(item?.artist ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [mainAudioId, setMainAudioId] = useState(item?.main_audio_id ?? '');
  const [intermediateMode, setIntermediateMode] = useState<IntermediateMode>(
    item?.intermediate_mode ?? 'GLOBAL_DEFAULT'
  );
  const [intermediateAudioId, setIntermediateAudioId] = useState(
    item?.intermediate_audio_id ?? null
  );
  const [fadeInMs, setFadeInMs] = useState<number | null>(item?.fade_in_loop_ms ?? null);
  const [fadeOutMs, setFadeOutMs] = useState<number | null>(item?.fade_out_loop_ms ?? null);

  const [mainPickerVisible, setMainPickerVisible] = useState(false);
  const [intermediatePickerVisible, setIntermediatePickerVisible] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const mainAsset = useMemo(
    () => mainAssets.find((a) => a.id === mainAudioId) ?? null,
    [mainAssets, mainAudioId]
  );
  const intermediateAsset = useMemo(
    () => intermediateAssets.find((a) => a.id === intermediateAudioId) ?? null,
    [intermediateAssets, intermediateAudioId]
  );

  const mainMissing = mainAsset?.is_missing ?? false;
  const intermediateMissing = intermediateAsset?.is_missing ?? false;

  const handleSelectMain = (asset: AudioAsset) => {
    setMainAudioId(asset.id);
    setMainPickerVisible(false);
    // Pre-rellenar título y artista desde los metadatos del asset si están vacíos
    if (!songTitle.trim() && asset.display_name) {
      setSongTitle(asset.display_name);
    }
    if (!artist.trim() && asset.artist) {
      setArtist(asset.artist);
    }
  };

  const handleSelectIntermediate = (asset: AudioAsset) => {
    setIntermediateAudioId(asset.id);
    setIntermediateMode('CUSTOM');
    setIntermediatePickerVisible(false);
  };

  const handleSave = () => {
    setSaveError(null);
    const title = songTitle.trim();
    if (!title) {
      setSaveError('El título de la canción es obligatorio.');
      return;
    }
    if (!mainAudioId) {
      setSaveError('Debes seleccionar una pista principal de audio.');
      return;
    }
    if (mainMissing) {
      setSaveError(
        'La pista principal seleccionada está marcada como faltante. Vuelve a vincularla en la biblioteca.'
      );
      return;
    }
    if (intermediateMode === 'CUSTOM' && !intermediateAudioId) {
      setSaveError('El intermedio personalizado requiere elegir un audio de la biblioteca.');
      return;
    }
    if (intermediateMode === 'CUSTOM' && intermediateMissing) {
      setSaveError('El loop intermedio seleccionado está marcado como faltante.');
      return;
    }

    onSave({
      song_title: title,
      artist: artist.trim() || null,
      notes: notes.trim() || null,
      main_audio_id: mainAudioId,
      intermediate_mode: intermediateMode,
      intermediate_audio_id: intermediateMode === 'CUSTOM' ? intermediateAudioId : null,
      fade_in_loop_ms: fadeInMs,
      fade_out_loop_ms: fadeOutMs,
    });
  };

  const submitButtonDisabled =
    !songTitle.trim() || !mainAudioId || mainMissing || saveError !== null;

  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <View style={styles.backdrop} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
            <Text style={styles.title}>{isNew ? 'Nueva canción' : 'Editar canción'}</Text>
            <Text style={styles.close} onPress={onCancel}>
              Cerrar
            </Text>
          </View>

          <FormField
            label="Título de la canción *"
            value={songTitle}
            onChangeText={setSongTitle}
            placeholder="Ej. Mi canción"
            error={
              saveError === 'El título de la canción es obligatorio.' ? 'Requerido' : undefined
            }
          />
          <FormField
            label="Artista"
            value={artist}
            onChangeText={setArtist}
            placeholder="Ej. Artista"
          />
          <FormField
            label="Notas"
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas, acordes, tempo…"
            multiline
            numberOfLines={3}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pista principal *</Text>
            <View style={styles.assetRow}>
              <Text style={styles.assetText}>
                {mainAsset ? mainAsset.display_name : 'Seleccionar pista principal…'}
              </Text>
              <LargeButton
                title="Seleccionar"
                style={styles.selectButton}
                onPress={() => setMainPickerVisible(true)}
              />
            </View>
            {mainAsset && mainMissing && (
              <Text style={styles.missingHint}>
                ⚠ Esta pista está marcada como faltante en la biblioteca.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loop intermedio</Text>
            <IntermediateModeSelector value={intermediateMode} onChange={setIntermediateMode} />
            {intermediateMode === 'CUSTOM' && (
              <View style={styles.assetRow}>
                <Text style={styles.assetText}>
                  {intermediateAsset
                    ? intermediateAsset.display_name
                    : 'Seleccionar loop intermedio…'}
                </Text>
                <LargeButton
                  title="Seleccionar"
                  style={styles.selectButton}
                  onPress={() => setIntermediatePickerVisible(true)}
                />
              </View>
            )}
            {intermediateMode === 'CUSTOM' && intermediateAsset && intermediateMissing && (
              <Text style={styles.missingHint}>
                ⚠ Este loop intermedio está marcado como faltante en la biblioteca.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Anulación de fade (opcional)</Text>
            <FadeInput
              label="Fade in (ms)"
              value={fadeInMs}
              onChange={setFadeInMs}
              error={undefined}
            />
            <FadeInput
              label="Fade out (ms)"
              value={fadeOutMs}
              onChange={setFadeOutMs}
              error={undefined}
            />
            <Text style={styles.hint}>
              `0` a `{MAX_FADE_MS}` ms. En blanco = usar predeterminado global.
            </Text>
          </View>

          {saveError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
          )}

          <View style={styles.footer}>
            <LargeButton title="Cancelar" style={styles.cancelButton} onPress={onCancel} />
            <LargeButton
              title="Guardar canción"
              style={styles.saveButton}
              light
              onPress={handleSave}
              disabled={submitButtonDisabled}
            />
          </View>
          </ScrollView>
        </Card>
      </View>

      {mainPickerVisible && (
        <AssetPickerModal
          visible={mainPickerVisible}
          title="Elegir pista principal"
          type="MAIN_TRACK"
          assets={mainAssets}
          onSelect={handleSelectMain}
          onCancel={() => setMainPickerVisible(false)}
          onImport={() => {
            setMainPickerVisible(false);
            // Import handled by parent via a callback; here we just close. The parent can reopen.
          }}
        />
      )}

      {intermediatePickerVisible && (
        <AssetPickerModal
          visible={intermediatePickerVisible}
          title="Elegir loop intermedio"
          type="INTERMEDIATE_LOOP"
          assets={intermediateAssets}
          onSelect={handleSelectIntermediate}
          onCancel={() => setIntermediatePickerVisible(false)}
          onImport={() => setIntermediatePickerVisible(false)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  card: {
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
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
  section: {
    marginTop: tokens.spacing.lg,
  },
  sectionTitle: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  assetText: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    flex: 1,
    minWidth: 0,
  },
  selectButton: {
    flexShrink: 0,
    minWidth: 100,
    minHeight: tokens.touchTarget.min,
  },
  missingHint: {
    color: colors.dark.warning,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    marginTop: tokens.spacing.xs,
  },
  hint: {
    color: colors.dark.textMuted,
    fontSize: tokens.fontSize.sm,
    marginTop: tokens.spacing.xs,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.dark.accent,
  },
});
