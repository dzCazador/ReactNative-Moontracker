/**
 * Modelo de dominio: setlist_items.
 * Representa una canción ordenada dentro de una setlist.
 */

import type { AudioAsset } from './audio-asset';

export type IntermediateMode = 'GLOBAL_DEFAULT' | 'CUSTOM' | 'SILENCE';

export const INTERMEDIATE_MODES: readonly IntermediateMode[] = [
  'GLOBAL_DEFAULT',
  'CUSTOM',
  'SILENCE',
];

export interface SetlistItem {
  id: string;
  setlist_id: string;
  position: number;
  song_title: string;
  artist: string | null;
  main_audio_id: string;
  intermediate_audio_id: string | null;
  intermediate_mode: IntermediateMode;
  notes: string | null;
  fade_out_loop_ms: number | null;
  fade_in_loop_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface SetlistItemWithAudio extends SetlistItem {
  main_audio: AudioAsset | null;
  intermediate_audio: AudioAsset | null;
}

export interface CreateSetlistItemInput {
  setlist_id: string;
  position?: number;
  song_title: string;
  artist?: string | null;
  main_audio_id: string;
  intermediate_audio_id?: string | null;
  intermediate_mode?: IntermediateMode;
  notes?: string | null;
  fade_out_loop_ms?: number | null;
  fade_in_loop_ms?: number | null;
}

export interface UpdateSetlistItemInput {
  id: string;
  song_title?: string;
  artist?: string | null;
  main_audio_id?: string;
  intermediate_audio_id?: string | null;
  intermediate_mode?: IntermediateMode;
  notes?: string | null;
  fade_out_loop_ms?: number | null;
  fade_in_loop_ms?: number | null;
  position?: number;
}
