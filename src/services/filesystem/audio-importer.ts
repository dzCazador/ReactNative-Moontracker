/**
 * Pipeline de importación de audio desde archivo local (document picker).
 *
 * Flujo:
 *  1. El usuario selecciona un archivo con expo-document-picker.
 *  2. Se valida extensión/MIME antes de importar.
 *  3. Se copia a FileSystem.documentDirectory + 'audio/' con nombre UUID + extensión.
 *  4. Se detectan duplicados (mismo nombre, tamaño y tipo): reusar o error.
 *  5. Se persisten metadatos en audio_assets.
 *  6. Todo funciona 100% offline.
 */

import * as DocumentPicker from 'expo-document-picker';
import { AudioAssetRepository } from '../../data/db/repositories/audio-asset-repository';
import type { AudioAsset } from '../../data/models/audio-asset';
import {
  copyFileToAppStorageAsync,
  deleteFileAsync,
  extensionOf,
  fileExistsAsync,
  isSupportedExtension,
  SUPPORTED_EXTENSIONS,
} from './file-storage';
import { logger } from '@/lib/logger';
import { ImportError, DuplicateAudioError, AudioAssetInUseError } from '@/lib/errors';
import { createAudioAssetInputSchema } from '@/lib/validation';

export type AudioSourceType = 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';

export const AUDIO_PICKER_MIME_TYPES = [
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mpeg',
  'audio/aac',
];

export interface ImportAudioOptions {
  source?: AudioSourceType;
  onDuplicate?: 'reuse' | 'copy';
}

export interface ImportedAudioResult {
  audio: AudioAsset;
  reused: boolean;
  fileCopied: boolean;
}

/**
 * Abre el selector de documentos y devuelve los assets escogidos.
 * Devuelve [] si el usuario cancela.
 */
export async function pickAudioFileAsync(
  options: { multiple?: boolean } = {}
): Promise<DocumentPicker.DocumentPickerAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: AUDIO_PICKER_MIME_TYPES,
    copyToCacheDirectory: false,
    multiple: options.multiple ?? false,
  });

  if (result.canceled) {
    return [];
  }
  return result.assets;
}

function isSupportedMimeType(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return (
    lower.includes('wav') ||
    lower.includes('ogg') ||
    lower.includes('flac') ||
    lower.includes('mpeg') ||
    lower.includes('mp3') ||
    lower.includes('aac') ||
    lower.includes('audio/')
  );
}

function findDuplicate(
  assets: AudioAsset[],
  {
    originalFilename,
    size,
    source,
  }: { originalFilename: string; size: number | null; source: AudioSourceType }
): AudioAsset | undefined {
  return assets.find((a) => {
    if (a.original_filename !== originalFilename || a.type !== source) {
      return false;
    }
    const sameSize =
      (a.file_size_bytes == null && size == null) ||
      (a.file_size_bytes != null && size != null && a.file_size_bytes === size);
    return sameSize;
  });
}

/**
 * Importa un archivo de audio seleccionado.
 * - Valida extensión antes de importar.
 * - Copia al almacenamiento gestionado (UUID + extensión original).
 * - Detecta duplicados: reutiliza el existente o lanza DuplicateAudioError.
 * - Persiste metadatos en audio_assets.
 */
export async function importAudioFileAsync(params: {
  uri: string;
  originalFilename: string;
  mimeType?: string | null;
  size?: number | null;
  source?: AudioSourceType;
  onDuplicate?: 'reuse' | 'copy';
}): Promise<ImportedAudioResult> {
  const {
    uri,
    originalFilename,
    mimeType,
    size = null,
    source = 'MAIN_TRACK',
    onDuplicate = 'reuse',
  } = params;

  const extension = extensionOf(originalFilename);
  if (!isSupportedExtension(extension)) {
    throw new ImportError(
      `Formato de audio no soportado: ${extension || '(sin extensión)'}. Formatos admitidos: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      { originalFilename, extension, mimeType, uri }
    );
  }

  if (mimeType && !isSupportedMimeType(mimeType)) {
    logger.warn('[audio-importer] MIME no coincide con extensiones admitidas', {
      mimeType,
      originalFilename,
    });
  }

  const repo = new AudioAssetRepository();
  const existingAssets = await repo.list({ includeMissing: true });
  const duplicate = findDuplicate(existingAssets, { originalFilename, size, source });

  if (duplicate) {
    if (onDuplicate === 'reuse') {
      logger.info('[audio-importer] duplicado detectado, reutilizando existente', {
        existingId: duplicate.id,
        originalFilename,
      });
      return { audio: duplicate, reused: true, fileCopied: false };
    }
    throw new DuplicateAudioError(
      `Ya existe un audio con el mismo nombre, tamaño y tipo: "${originalFilename}"`,
      { existingId: duplicate.id, originalFilename, extension, uri }
    );
  }

  let internalUri: string;
  let fileSize: number;
  try {
    const copied = await copyFileToAppStorageAsync({ uri, originalFilename });
    internalUri = copied.internalUri;
    fileSize = copied.size;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(`No se pudo importar el archivo: ${originalFilename}`, {
      original: error instanceof Error ? error.message : String(error),
      originalFilename,
      extension,
      uri,
    });
  }

  const input = {
    type: source,
    display_name: originalFilename,
    original_filename: originalFilename,
    internal_uri: internalUri,
    external_source_uri: null,
    source_url: null,
    file_extension: extension,
    mime_type: mimeType ?? null,
    duration_ms: null,
    file_size_bytes: fileSize ?? null,
    sample_rate: null,
    channels: null,
    loudness_hint_db: null,
  };

  const parsed = createAudioAssetInputSchema.safeParse(input);
  if (!parsed.success) {
    await deleteFileAsync(internalUri);
    throw new ImportError('Metadatos de audio inválidos', {
      original: parsed.error.message,
      originalFilename,
      internalUri,
    });
  }

  const audio = await repo.create(parsed.data);

  logger.info('[audio-importer] archivo importado', {
    audioId: audio.id,
    originalFilename,
    internalUri,
    fileSize,
  });

  return { audio, reused: false, fileCopied: true };
}

/**
 * Escanea todos los audio_assets y actualiza is_missing según exista el archivo en disco.
 */
export async function detectMissingFilesAsync(): Promise<{
  checked: number;
  markedMissing: number;
}> {
  const repo = new AudioAssetRepository();
  const assets = await repo.list({ includeMissing: true });

  let markedMissing = 0;
  for (const asset of assets) {
    const exists = await fileExistsAsync(asset.internal_uri);
    const shouldBeMissing = !exists;
    if (shouldBeMissing !== asset.is_missing) {
      await repo.markMissing(asset.id, shouldBeMissing);
      markedMissing += 1;
    }
  }

  return { checked: assets.length, markedMissing };
}

/**
 * Eliminación segura de un audio asset: borra la fila de DB y el archivo solo cuando
 * no hay referencias en setlist_items (main o intermedio). Si hay referencias y no se
 * fuerza, no se borra nada y se devuelve deleted: false.
 */
export async function safeDeleteAudioAssetAsync(params: {
  id: string;
  force?: boolean;
}): Promise<{ deleted: boolean; fileDeleted: boolean }> {
  const { id, force = false } = params;
  const repo = new AudioAssetRepository();

  const asset = await repo.getById(id);
  if (!asset) {
    return { deleted: false, fileDeleted: false };
  }

  try {
    await repo.delete(id, { force });
  } catch (error) {
    if (error instanceof AudioAssetInUseError) {
      logger.warn('[audio-importer] eliminación bloqueada por referencias', { audioId: id });
      return { deleted: false, fileDeleted: false };
    }
    throw error;
  }

  let fileDeleted = false;
  // Si se forzó la eliminación pero aún hay referencias, no tocamos el archivo
  // para no romper las canciones que aún lo usan.
  if (!force) {
    await deleteFileAsync(asset.internal_uri);
    fileDeleted = true;
  }

  return { deleted: true, fileDeleted };
}
