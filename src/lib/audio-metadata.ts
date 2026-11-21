/**
 * Lee metadatos ID3 (título, artista, álbum, duración) de un archivo de audio
 * local usando music-metadata (JS puro, sin código nativo).
 *
 * Recibe un URI tipo file:// y devuelve los metadatos encontrados, o null si
 * el archivo no tiene metadatos o no se puede leer.
 */

import * as FileSystem from 'expo-file-system';
import { parseBuffer } from 'music-metadata';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number; // segundos
}

export async function readAudioMetadata(fileUri: string): Promise<AudioMetadata | null> {
  if (!fileUri || !fileUri.startsWith('file://')) {
    return null;
  }

  try {
    // Leer el archivo como base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convertir base64 a Uint8Array
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Parsear metadatos con music-metadata
    const metadata = await parseBuffer(bytes, undefined, { skipCovers: true });

    const result: AudioMetadata = {};

    const common = metadata.common;
    if (common?.title) result.title = common.title;
    if (common?.artist) result.artist = common.artist;
    if (common?.album) result.album = common.album;
    if (metadata.format?.duration) result.duration = metadata.format.duration;

    // Si no se encontró ningún campo útil, devolver null
    if (!result.title && !result.artist && !result.album) {
      return null;
    }

    return result;
  } catch (error) {
    // No lanzar: si no se pueden leer los metadatos, simplemente devolvemos null
    // y la app continúa usando el nombre del archivo como display_name.
    return null;
  }
}
