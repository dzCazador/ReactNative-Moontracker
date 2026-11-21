import { describe, it, expect } from '@jest/globals';
import {
  createAudioAssetInputSchema,
  createSetlistInputSchema,
  createSetlistItemInputSchema,
  updateAudioAssetInputSchema,
  updateSetlistInputSchema,
  updateSetlistItemInputSchema,
  uuidSchema,
} from '@/lib/validation';

describe('validación de audio_assets', () => {
  it('acepta una entrada de audio válida', () => {
    const result = createAudioAssetInputSchema.safeParse({
      type: 'MAIN_TRACK',
      display_name: 'Mi pista',
      original_filename: 'mi-pista.wav',
      internal_uri: 'file:///mock/document/audio/abc.wav',
      file_extension: '.wav',
      mime_type: 'audio/wav',
      duration_ms: 120000,
      file_size_bytes: 2_000_000,
      sample_rate: 44100,
      channels: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('MAIN_TRACK');
    }
  });

  it('rechaza audio sin tipo', () => {
    const result = createAudioAssetInputSchema.safeParse({
      display_name: 'x',
      original_filename: 'x.wav',
      internal_uri: 'file:///x.wav',
      file_extension: '.wav',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza extensión de audio no soportada vacía', () => {
    const result = createAudioAssetInputSchema.safeParse({
      type: 'MAIN_TRACK',
      display_name: 'x',
      original_filename: 'x',
      internal_uri: 'file:///x',
      file_extension: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('validación de setlists', () => {
  it('acepta una setlist válida', () => {
    const result = createSetlistInputSchema.safeParse({
      name: 'Mi setlist',
      description: 'Descripción',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza setlist sin nombre', () => {
    const result = createSetlistInputSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('validación de setlist_items', () => {
  it('acepta un ítem válido', () => {
    const result = createSetlistItemInputSchema.safeParse({
      setlist_id: '44444444-4444-4444-8444-444444444444',
      song_title: 'Canción',
      main_audio_id: '55555555-5555-5555-8555-555555555555',
      intermediate_mode: 'CUSTOM',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza ítem con modo intermedio inválido', () => {
    const result = createSetlistItemInputSchema.safeParse({
      setlist_id: '44444444-4444-4444-8444-444444444444',
      song_title: 'Canción',
      main_audio_id: '55555555-5555-5555-8555-555555555555',
      intermediate_mode: 'INVALIDO',
    });
    expect(result.success).toBe(false);
  });

  it('genera uuid válido', () => {
    expect(uuidSchema.safeParse('44444444-4444-4444-8444-444444444444').success).toBe(true);
    expect(uuidSchema.safeParse('no-es-un-uuid').success).toBe(false);
  });
});

describe('esquemas de actualización', () => {
  it('updateAudioAssetInput requiere id', () => {
    const result = updateAudioAssetInputSchema.safeParse({
      id: '44444444-4444-4444-8444-444444444444',
      display_name: 'Nuevo nombre',
    });
    expect(result.success).toBe(true);
  });

  it('updateSetlistInput requiere id', () => {
    const result = updateSetlistInputSchema.safeParse({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Nuevo nombre',
    });
    expect(result.success).toBe(true);
  });

  it('updateSetlistItemInput requiere id', () => {
    const result = updateSetlistItemInputSchema.safeParse({
      id: '44444444-4444-4444-8444-444444444444',
      position: 2,
    });
    expect(result.success).toBe(true);
  });
});
