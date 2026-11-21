/**
 * Definición de tablas, índices y versión del esquema de SQLite.
 *
 * Comportamiento de claves foráneas (documentado):
 * - setlists.default_intermediate_audio_id -> audio_assets.id  ON DELETE SET NULL
 *   Si se borra el audio predeterminado de una setlist, la setlist se queda sin predeterminado
 *   (no se borra la setlist ni sus canciones).
 * - setlist_items.setlist_id -> setlists.id  ON DELETE CASCADE
 *   Al borrar una setlist se borran sus ítems.
 * - setlist_items.main_audio_id -> audio_assets.id  ON DELETE NO ACTION (RESTRICT)
 *   El audio principal es obligatorio; no se puede borrar un audio usado como principal de una
 *   canción sin antes reasignar o borrar la canción. Evita referencias huérfanas.
 * - setlist_items.intermediate_audio_id -> audio_assets.id  ON DELETE SET NULL
 *   Si se borra el loop personalizado de una canción, se vuelve al predeterminado de la setlist/global.
 *
 * PRAGMA foreign_keys = ON debe ejecutarse al abrir la base de datos (ver connection.ts).
 */

export const SCHEMA_VERSION = 1;

export const TABLE_AUDIO_ASSETS = 'audio_assets';
export const TABLE_SETLISTS = 'setlists';
export const TABLE_SETLIST_ITEMS = 'setlist_items';
export const TABLE_APP_SETTINGS = 'app_settings';
export const TABLE_SCHEMA_MIGRATIONS = 'schema_migrations';

export const CREATE_TABLE_SCHEMA_MIGRATIONS = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

export const CREATE_TABLE_AUDIO_ASSETS = `
CREATE TABLE IF NOT EXISTS audio_assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('MAIN_TRACK', 'INTERMEDIATE_LOOP')),
  display_name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  internal_uri TEXT NOT NULL,
  external_source_uri TEXT,
  source_url TEXT,
  file_extension TEXT NOT NULL,
  mime_type TEXT,
  duration_ms INTEGER,
  file_size_bytes INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  loudness_hint_db REAL,
  is_missing INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_TABLE_SETLISTS = `
CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_intermediate_audio_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_played_at TEXT,
  FOREIGN KEY (default_intermediate_audio_id) REFERENCES audio_assets(id) ON DELETE SET NULL
);
`;

export const CREATE_TABLE_SETLIST_ITEMS = `
CREATE TABLE IF NOT EXISTS setlist_items (
  id TEXT PRIMARY KEY,
  setlist_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  song_title TEXT NOT NULL,
  artist TEXT,
  main_audio_id TEXT NOT NULL,
  intermediate_audio_id TEXT,
  intermediate_mode TEXT NOT NULL CHECK(intermediate_mode IN ('GLOBAL_DEFAULT', 'CUSTOM', 'SILENCE')),
  notes TEXT,
  fade_out_loop_ms INTEGER,
  fade_in_loop_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
  FOREIGN KEY (main_audio_id) REFERENCES audio_assets(id) ON DELETE NO ACTION,
  FOREIGN KEY (intermediate_audio_id) REFERENCES audio_assets(id) ON DELETE SET NULL,
  UNIQUE(setlist_id, position)
);
`;

export const CREATE_TABLE_APP_SETTINGS = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist_id ON setlist_items(setlist_id);`,
  `CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist_position ON setlist_items(setlist_id, position);`,
  `CREATE INDEX IF NOT EXISTS idx_audio_assets_type ON audio_assets(type);`,
  `CREATE INDEX IF NOT EXISTS idx_audio_assets_is_missing ON audio_assets(is_missing);`,
  `CREATE INDEX IF NOT EXISTS idx_setlists_updated_at ON setlists(updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);`,
];

/**
 * Sentencias DDL de la migración inicial, en orden de ejecución.
 */
export const INITIAL_MIGRATION_DDL: string[] = [
  CREATE_TABLE_SCHEMA_MIGRATIONS,
  CREATE_TABLE_AUDIO_ASSETS,
  CREATE_TABLE_SETLISTS,
  CREATE_TABLE_SETLIST_ITEMS,
  CREATE_TABLE_APP_SETTINGS,
  ...INDEXES,
];
