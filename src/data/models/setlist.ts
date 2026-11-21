/**
 * Modelo de dominio: setlists.
 */

export interface Setlist {
  id: string;
  name: string;
  description: string | null;
  default_intermediate_audio_id: string | null;
  created_at: string;
  updated_at: string;
  last_played_at: string | null;
}

export interface SetlistWithCounts extends Setlist {
  item_count: number;
  has_missing_audio: boolean;
}

export interface CreateSetlistInput {
  name: string;
  description?: string | null;
  default_intermediate_audio_id?: string | null;
}

export interface UpdateSetlistInput {
  id: string;
  name?: string;
  description?: string | null;
  default_intermediate_audio_id?: string | null;
  last_played_at?: string | null;
}
