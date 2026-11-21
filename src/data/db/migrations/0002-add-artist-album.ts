/**
 * Migración 0002: agregar columnas artist y album a audio_assets.
 * Las columnas son nullable para no romper registros existentes.
 */
import type { Migration } from './migration-runner';

export const ADD_ARTIST_ALBUM_MIGRATION: Migration = {
  version: 2,
  name: 'add_artist_album',
  up: `
    ALTER TABLE audio_assets ADD COLUMN artist TEXT;
    ALTER TABLE audio_assets ADD COLUMN album TEXT;
  `,
};
