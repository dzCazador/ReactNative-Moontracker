/**
 * Lee metadatos ID3 (título, artista, álbum) de un archivo de audio local.
 * Soporta ID3v1 (128 bytes al final del archivo) e ID3v2.3/2.4 (header al inicio).
 * No requiere librerías externas: parsea los bytes directamente.
 */

export interface AudioId3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number; // seconds
}

function decodeLatin1(bytes: Uint8Array, start: number, length: number): string {
  let result = '';
  for (let i = start; i < start + length; i++) {
    const byte = bytes[i];
    if (byte === 0) break;
    result += String.fromCharCode(byte);
  }
  return result.trim();
}

function readId3v1(bytes: Uint8Array): AudioId3Metadata | null {
  const len = bytes.length;
  if (len < 128) return null;

  const tagStart = len - 128;
  if (bytes[tagStart] !== 0x54 || bytes[tagStart + 1] !== 0x41 || bytes[tagStart + 2] !== 0x47) {
    return null; // "TAG"
  }

  const title = decodeLatin1(bytes, tagStart + 3, 30);
  const artist = decodeLatin1(bytes, tagStart + 33, 30);
  const album = decodeLatin1(bytes, tagStart + 63, 30);

  const result: AudioId3Metadata = {};
  if (title) result.title = title;
  if (artist) result.artist = artist;
  if (album) result.album = album;

  return Object.keys(result).length > 0 ? result : null;
}

function readSyncSafeInt(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] & 0x7f) * 0x200000 +
    (bytes[offset + 1] & 0x7f) * 0x4000 +
    (bytes[offset + 2] & 0x7f) * 0x80 +
    (bytes[offset + 3] & 0x7f)
  );
}

function readId3v2(bytes: Uint8Array): AudioId3Metadata | null {
  if (bytes.length < 10) return null;
  // ID3v2 header: "ID3" + version (2 bytes) + flags + size (4 syncsafe bytes)
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }

  const version = bytes[3]; // 2, 3, or 4
  const tagSize = readSyncSafeInt(bytes, 6);
  const end = Math.min(10 + tagSize, bytes.length);

  const result: AudioId3Metadata = {};
  let pos = 10;

  while (pos < end - 10) {
    let frameId: string;
    let frameSize: number;

    if (version === 2) {
      // ID3v2.2: 3-byte frame ID, 3-byte size
      frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2]);
      frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
      pos += 6;
    } else {
      // ID3v2.3/2.4: 4-byte frame ID, 4-byte size
      frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
      if (version === 4) {
        frameSize = readSyncSafeInt(bytes, pos + 4);
      } else {
        frameSize = (bytes[pos + 4] << 24) | (bytes[pos + 5] << 16) | (bytes[pos + 6] << 8) | bytes[pos + 7];
      }
      pos += 10;
    }

    if (frameSize <= 0 || pos + frameSize > end) break;

    const encoding = bytes[pos];
    const textBytes = bytes.slice(pos + 1, pos + frameSize);

    let text = '';
    if (encoding === 0) {
      // Latin-1
      text = decodeLatin1(textBytes, 0, textBytes.length);
    } else if (encoding === 1) {
      // UTF-16 with BOM
      const start = textBytes[0] === 0xff && textBytes[1] === 0xfe ? 2 : 0;
      text = new TextDecoder('utf-16le').decode(textBytes.slice(start));
    } else if (encoding === 2) {
      // UTF-16BE
      text = new TextDecoder('utf-16be').decode(textBytes);
    } else if (encoding === 3) {
      // UTF-8
      text = new TextDecoder('utf-8').decode(textBytes);
    }

    if (frameId === 'TIT2' || frameId === 'TT2') {
      if (text && !result.title) result.title = text.trim();
    } else if (frameId === 'TPE1' || frameId === 'TP1') {
      if (text && !result.artist) result.artist = text.trim();
    } else if (frameId === 'TALB' || frameId === 'TAL') {
      if (text && !result.album) result.album = text.trim();
    }

    pos += frameSize;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function readId3Metadata(bytes: Uint8Array): AudioId3Metadata | null {
  // Try ID3v2 first (at the beginning of the file)
  const v2 = readId3v2(bytes);
  if (v2) return v2;

  // Fall back to ID3v1 (at the end of the file)
  return readId3v1(bytes);
}

import * as FileSystem from 'expo-file-system/legacy';

// Wrapper that reads a file from a file:// URI and returns metadata
export async function readAudioMetadata(fileUri: string): Promise<AudioId3Metadata | null> {
  if (!fileUri || !fileUri.startsWith('file://')) {
    return null;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return readId3Metadata(bytes);
  } catch {
    return null;
  }
}