/**
 * Resolución determinista del audio intermedio efectivo para una canción de una setlist.
 *
 * Precedencia (definida en el plan de etapa 02):
 *  1. Canción SILENCE -> sin loop.
 *  2. Canción CUSTOM -> intermedio de la canción.
 *  3. Predeterminado de la setlist -> intermedio de la setlist.
 *  4. Predeterminado global -> ajuste de la app.
 *  5. Nada configurado -> silencio + indicador de advertencia (NONE).
 *
 * Función pura: fácil de probar unitaria y sin efectos secundarios.
 */

import type { SetlistItem, AudioAsset } from '@/data/models';

export type IntermediateResolutionReason =
  'CUSTOM' | 'SETLIST_DEFAULT' | 'GLOBAL_DEFAULT' | 'SILENCE' | 'NONE';

export interface IntermediateResolutionContext {
  item: Pick<SetlistItem, 'intermediate_mode' | 'intermediate_audio_id'>;
  setlistDefaultAudioId: string | null;
  globalDefaultAudioId: string | null;
  assetsById: Record<string, AudioAsset>;
}

export interface IntermediateResolutionResult {
  audio: AudioAsset | null;
  reason: IntermediateResolutionReason;
}

export function resolveEffectiveIntermediateAudio(
  context: IntermediateResolutionContext
): IntermediateResolutionResult {
  const { item, setlistDefaultAudioId, globalDefaultAudioId, assetsById } = context;

  // 1. Canción configurada como silencio: no hay loop.
  if (item.intermediate_mode === 'SILENCE') {
    return { audio: null, reason: 'SILENCE' };
  }

  // 2. Canción con intermedio personalizado.
  if (item.intermediate_mode === 'CUSTOM' && item.intermediate_audio_id) {
    const audio = assetsById[item.intermediate_audio_id] ?? null;
    return { audio, reason: audio ? 'CUSTOM' : 'NONE' };
  }

  // 3. Predeterminado de la setlist.
  if (setlistDefaultAudioId) {
    const audio = assetsById[setlistDefaultAudioId] ?? null;
    return { audio, reason: audio ? 'SETLIST_DEFAULT' : 'NONE' };
  }

  // 4. Predeterminado global de la app.
  if (globalDefaultAudioId) {
    const audio = assetsById[globalDefaultAudioId] ?? null;
    return { audio, reason: audio ? 'GLOBAL_DEFAULT' : 'NONE' };
  }

  // 5. Nada configurado.
  return { audio: null, reason: 'NONE' };
}
