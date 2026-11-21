/**
 * Pipeline de importación de audio por URL (descarga prep-time).
 *
 * Características:
 *  - Valida la URL y la extensión esperada antes de descargar.
 *  - Descarga con createDownloadResumable (admite reanudación de interrupciones).
 *  - Verifica espacio en disco antes de empezar; aborta con error accionable si no hay suficiente.
 *  - Usa un archivo temporal (.part) y lo limpia si la descarga no se completa.
 *  - Valida el formato una vez completada; nunca reproduce desde la URL (source_url solo es metadato).
 *  - Todo funciona 100% offline una vez descargado (se reproduce desde internal_uri).
 */

import {
  createDownloadResumable,
  getFreeDiskStorageAsync,
  getInfoAsync,
  moveAsync,
} from 'expo-file-system/legacy';
import type { AudioAsset } from '../../data/models/audio-asset';
import { AudioAssetRepository } from '../../data/db/repositories/audio-asset-repository';
import {
  ensureAudioDirectoryAsync,
  extensionOf,
  internalUriFor,
  isSupportedExtension,
  SUPPORTED_EXTENSIONS,
  fileExistsAsync,
  deleteFileAsync,
} from './file-storage';
import { generateId } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { ImportError, StorageError } from '@/lib/errors';
import { createAudioAssetInputSchema } from '@/lib/validation';

export type AudioSourceType = 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';

export interface DownloadProgress {
  totalBytes: number;
  bytesWritten: number;
}

export interface DownloadAudioOptions {
  url: string;
  fileName?: string;
  source?: AudioSourceType;
  minimumFreeBytes?: number;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadedAudioResult {
  audio: AudioAsset;
  fileName: string;
  internalUri: string;
}

function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.slice(parsed.pathname.lastIndexOf('/') + 1) || 'audio';
    return last.split('?')[0].split('#')[0] || 'audio';
  } catch {
    return 'audio';
  }
}

export async function downloadAudioFromUrlAsync(
  params: DownloadAudioOptions
): Promise<DownloadedAudioResult> {
  const { url, fileName, source = 'MAIN_TRACK', minimumFreeBytes, onProgress } = params;

  // 1. Validar URL.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!parsedUrl.protocol || !parsedUrl.host) {
      throw new Error('URL sin protocolo o host');
    }
  } catch {
    throw new ImportError(`URL inválida: ${url}`, { url });
  }

  const suggestedFileName = fileName ?? fileNameFromUrl(url);
  const extension = extensionOf(suggestedFileName);
  if (!isSupportedExtension(extension)) {
    throw new ImportError(
      `Formato de audio no soportado: ${extension || '(sin extensión)'}. Formatos admitidos: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      { url, fileName: suggestedFileName, extension }
    );
  }

  // 2. Verificar espacio en disco antes de descargar.
  if (minimumFreeBytes != null) {
    try {
      const free = await getFreeDiskStorageAsync();
      if (free < minimumFreeBytes) {
        throw new ImportError(
          `Espacio insuficiente para descargar: se necesitan ${minimumFreeBytes} bytes y hay ${free} disponibles`,
          { url, freeBytes: free, requiredBytes: minimumFreeBytes }
        );
      }
    } catch (error) {
      if (error instanceof ImportError) throw error;
      logger.warn('[audio-downloader] no se pudo verificar espacio en disco', { url, error });
    }
  }

  await ensureAudioDirectoryAsync();

  const finalFileName = fileName ?? `${generateId()}${extension}`;
  const internalUri = internalUriFor(finalFileName);
  const tempUri = `${internalUri}.part`;

  // Limpiar parciales previos de este archivo.
  if (await fileExistsAsync(tempUri)) {
    await deleteFileAsync(tempUri);
  }
  if (await fileExistsAsync(internalUri)) {
    await deleteFileAsync(internalUri);
  }

  // 3. Descarga resumable al archivo temporal.
  const download = createDownloadResumable(url, tempUri, {}, (progress) => {
    onProgress?.({
      totalBytes: progress.totalBytesExpectedToWrite,
      bytesWritten: progress.totalBytesWritten,
    });
  });

  try {
    await download.downloadAsync();
  } catch (error) {
    await deleteFileAsync(tempUri);
    throw new ImportError(`Fallo al descargar audio desde ${url}`, {
      original: error instanceof Error ? error.message : String(error),
      url,
    });
  }

  // 4. Mover temporal al URI final gestionado por la app.
  try {
    await moveAsync({ from: tempUri, to: internalUri });
  } catch (error) {
    await deleteFileAsync(tempUri);
    throw new StorageError(`No se pudo finalizar la descarga de ${url}`, {
      original: String(error),
    });
  }

  // 5. Verificar que el archivo quedó en disco y validar formato.
  if (!(await fileExistsAsync(internalUri))) {
    await deleteFileAsync(internalUri);
    throw new ImportError(`Descarga incompleta o no se escribió en disco: ${url}`, { url });
  }

  const info = await getInfoAsync(internalUri);
  const fileSize = info.exists ? info.size : null;

  // 6. Persistir metadatos en audio_assets. source_url se guarda solo como metadato informativo.
  const repo = new AudioAssetRepository();
  const input = {
    type: source,
    display_name: suggestedFileName,
    original_filename: suggestedFileName,
    internal_uri: internalUri,
    external_source_uri: url,
    source_url: url,
    file_extension: extension,
    mime_type: null,
    duration_ms: null,
    file_size_bytes: fileSize,
    sample_rate: null,
    channels: null,
    loudness_hint_db: null,
  };

  const parsed = createAudioAssetInputSchema.safeParse(input);
  if (!parsed.success) {
    await deleteFileAsync(internalUri);
    throw new ImportError('Metadatos de descarga inválidos', {
      original: parsed.error.message,
      url,
      internalUri,
    });
  }

  const audio = await repo.create(parsed.data);

  logger.info('[audio-downloader] descarga completada', {
    audioId: audio.id,
    url,
    internalUri,
    fileSize,
  });

  return { audio, fileName: finalFileName, internalUri };
}
