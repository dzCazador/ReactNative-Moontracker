/**
 * Acceso de bajo nivel al sistema de archivos gestionado por la app.
 * Importa la API legacy de `expo-file-system/legacy` (el punto de entrada principal
 * de `expo-file-system` en SDK 58 expone solo wrappers deprecated que lanzan en runtime).
 *
 * Los audios importados/descargados viven en FileSystem.documentDirectory + 'audio/'.
 */

import { Platform } from 'react-native';
import {
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { generateId } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { StorageError, ImportError } from '@/lib/errors';

const IS_WEB = Platform.OS === 'web';

let documentDirectory: string | undefined;
if (!IS_WEB) {
  documentDirectory = require('expo-file-system/legacy').documentDirectory;
}

export const AUDIO_DIRECTORY = IS_WEB ? '' : `${documentDirectory}audio/`;

function requireNativeFS(): void {
  if (IS_WEB) {
    throw new StorageError('FileSystem no está disponible en web. Usa un dispositivo Android.');
  }
}

/**
 * Extensiones de audio admitidas para importación.
 */
export const SUPPORTED_EXTENSIONS: readonly string[] = ['.wav', '.ogg', '.flac', '.mp3', '.m4a', '.aac'];

export type SupportedAudioExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function isSupportedExtension(extension: string): extension is SupportedAudioExtension {
  return SUPPORTED_EXTENSIONS.includes(extension.toLowerCase() as SupportedAudioExtension);
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

export function internalUriFor(fileName: string): string {
  return `${AUDIO_DIRECTORY}${fileName}`;
}

export function fileNameFromUri(uri: string): string {
  const key = uri.endsWith('/') ? uri.slice(0, -1) : uri;
  const slash = key.lastIndexOf('/');
  return slash === -1 ? key : key.slice(slash + 1);
}

/**
 * Crea el directorio de audios de la app si no existe.
 */
export async function ensureAudioDirectoryAsync(): Promise<void> {
  requireNativeFS();
  try {
    await makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
  } catch (error) {
    logger.error('[file-storage] ensureAudioDirectoryAsync failed', {
      directory: AUDIO_DIRECTORY,
      error,
    });
    throw new StorageError(`No se pudo crear el directorio de audios: ${AUDIO_DIRECTORY}`, {
      original: String(error),
    });
  }
}

/**
 * Comprueba si un archivo existe en el dispositivo.
 */
export async function fileExistsAsync(uri: string): Promise<boolean> {
  requireNativeFS();
  try {
    const info = await getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

/**
 * Devuelve el tamaño en bytes de un archivo, o null si no existe/no se puede leer.
 */
export async function getFileSizeAsync(uri: string): Promise<number | null> {
  requireNativeFS();
  try {
    const info = await getInfoAsync(uri);
    if (info.exists) {
      return info.size;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Copia un archivo seleccionado (document picker / descarga) al almacenamiento gestionado
 * con un nombre interno estable: UUID + extensión original.
 */
export async function copyFileToAppStorageAsync(params: {
  uri: string;
  originalFilename: string;
}): Promise<{ internalUri: string; fileName: string; size: number }> {
  requireNativeFS();
  const { uri, originalFilename } = params;
  const extension = extensionOf(originalFilename);

  if (!isSupportedExtension(extension)) {
    throw new ImportError(
      `Formato de audio no soportado: ${extension || '(sin extensión)'}. Formatos admitidos: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      { originalFilename, extension, uri }
    );
  }

  await ensureAudioDirectoryAsync();

  const fileName = `${generateId()}${extension}`;
  const internalUri = internalUriFor(fileName);

  try {
    await copyAsync({ from: uri, to: internalUri });
  } catch (error) {
    logger.error('[file-storage] copyFileToAppStorageAsync failed', {
      from: uri,
      to: internalUri,
      error,
    });
    throw new StorageError(
      `No se pudo copiar el archivo al almacenamiento interno: ${originalFilename}`,
      {
        original: String(error),
      }
    );
  }

  const info = await getInfoAsync(internalUri);
  if (!info.exists) {
    throw new StorageError(`El archivo no quedó persistido tras la copia: ${internalUri}`);
  }

  return { internalUri, fileName, size: info.size };
}

/**
 * Elimina un archivo gestionado por la app (idempotente: no falla si ya no existe).
 */
export async function deleteFileAsync(uri: string): Promise<void> {
  requireNativeFS();
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch (error) {
    logger.warn('[file-storage] deleteFileAsync failed', { uri, error });
    // No propagamos: el archivo puede ya no existir.
  }
}
