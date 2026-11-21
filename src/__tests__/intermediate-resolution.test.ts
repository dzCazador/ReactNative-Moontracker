import { describe, it, expect } from '@jest/globals';
import {
  resolveEffectiveIntermediateAudio,
  type IntermediateResolutionContext,
} from '@/lib/intermediate-resolution';
import type { AudioAsset } from '@/data/models';

const audio = (id: string): AudioAsset => ({
  id,
  type: 'INTERMEDIATE_LOOP',
  display_name: 'Loop ' + id,
  original_filename: 'loop.wav',
  internal_uri: 'file:///mock/document/audio/loop.wav',
  external_source_uri: null,
  source_url: null,
  file_extension: '.wav',
  mime_type: 'audio/wav',
  duration_ms: null,
  file_size_bytes: null,
  sample_rate: null,
  channels: null,
  loudness_hint_db: null,
  artist: null,
  album: null,
  is_missing: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

function contextFactory(
  overrides: Partial<IntermediateResolutionContext> = {}
): IntermediateResolutionContext {
  const assetsById: Record<string, AudioAsset> = {
    custom: audio('custom'),
    setlist: audio('setlist'),
    global: audio('global'),
  };
  return {
    item: { intermediate_mode: 'GLOBAL_DEFAULT', intermediate_audio_id: null },
    setlistDefaultAudioId: 'setlist',
    globalDefaultAudioId: 'global',
    assetsById,
    ...overrides,
  };
}

describe('resolución de audio intermedio', () => {
  it('SILENCE devuelve null sin consultar ningún audio', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'SILENCE', intermediate_audio_id: 'custom' },
      setlistDefaultAudioId: null,
      globalDefaultAudioId: null,
      assetsById: {},
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio).toBeNull();
    expect(result.reason).toBe('SILENCE');
  });

  it('CUSTOM usa el intermedio de la canción', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'CUSTOM', intermediate_audio_id: 'custom' },
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio?.id).toBe('custom');
    expect(result.reason).toBe('CUSTOM');
  });

  it('CUSTOM con id inexistente devuelve NONE', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'CUSTOM', intermediate_audio_id: 'no-existe' },
      setlistDefaultAudioId: null,
      globalDefaultAudioId: null,
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio).toBeNull();
    expect(result.reason).toBe('NONE');
  });

  it('sin modo personalizado usa predeterminado de la setlist', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'GLOBAL_DEFAULT', intermediate_audio_id: null },
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio?.id).toBe('setlist');
    expect(result.reason).toBe('SETLIST_DEFAULT');
  });

  it('sin predeterminado de setlist usa global', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'GLOBAL_DEFAULT', intermediate_audio_id: null },
      setlistDefaultAudioId: null,
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio?.id).toBe('global');
    expect(result.reason).toBe('GLOBAL_DEFAULT');
  });

  it('sin nada configurado devuelve NONE', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'GLOBAL_DEFAULT', intermediate_audio_id: null },
      setlistDefaultAudioId: null,
      globalDefaultAudioId: null,
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.audio).toBeNull();
    expect(result.reason).toBe('NONE');
  });

  it('la precedencia es determinista: CUSTOM gana sobre setlist y global', () => {
    const ctx = contextFactory({
      item: { intermediate_mode: 'CUSTOM', intermediate_audio_id: 'custom' },
    });
    const result = resolveEffectiveIntermediateAudio(ctx);
    expect(result.reason).toBe('CUSTOM');
    expect(result.audio?.id).toBe('custom');
  });
});
