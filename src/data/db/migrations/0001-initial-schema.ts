/**
 * Migración 0001: esquema inicial.
 * Crea audio_assets, setlists, setlist_items, app_settings, tabla de seguimiento de migraciones e índices.
 */

import type { Migration } from './migration-runner';
import { INITIAL_MIGRATION_DDL } from '../schema/tables';

export const INITIAL_MIGRATION: Migration = {
  version: 1,
  name: 'initial_schema',
  up: INITIAL_MIGRATION_DDL.join('\n'),
};
