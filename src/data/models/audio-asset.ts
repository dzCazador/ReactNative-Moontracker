/**
 * Modelo de dominio: audio_assets.
 * Almacena metadatos de pistas principales (MAIN_TRACK) y loops intermedios (INTERMEDIATE_LOOP).
 */

export type AudioAssetType = 'MAIN_TRACK' | 'INTERMEDIATE_LOOP';

export const AUDIO_ASSET_TYPES: readonly AudioAssetType[] = ['MAIN_TRACK', 'INTERMEDIATE_LOOP'];

export interface AudioAsset {
  id: string;
  type: AudioAssetType;
  display_name: string;
  original_filename: string;
  internal_uri: string;
  external_source_uri: string | null;
  source_url: string | null;
  file_extension: string;
  mime_type: string | null;
  duration_ms: number | null;
  file_size_bytes: number | null;
  sample_rate: number | null;
  channels: number | null;
  loudness_hint_db: number | null;
  is_missing: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAudioAssetInput {
  type: AudioAssetType;
  display_name: string;
  original_filename: string;
  internal_uri: string;
  external_source_uri?: string | null;
  source_url?: string | null;
  file_extension: string;
  mime_type?: string | null;
  duration_ms?: number | null;
  file_size_bytes?: number | null;
  sample_rate?: number | null;
  channels?: number | null;
  loudness_hint_db?: number | null;
}

export interface UpdateAudioAssetInput {
  id: string;
  type?: AudioAssetType;
  display_name?: string;
  original_filename?: string;
  internal_uri?: string;
  external_source_uri?: string | null;
  source_url?: string | null;
  file_extension?: string;
  mime_type?: string | null;
  duration_ms?: number | null;
  file_size_bytes?: number | null;
  sample_rate?: number | null;
  channels?: number | null;
  loudness_hint_db?: number | null;
  is_missing?: boolean;
}
