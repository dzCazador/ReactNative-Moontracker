export type { Migration } from './migration-runner';
export {
  MIGRATIONS,
  runMigrations,
  getAppliedVersions,
  ensureMigrationTrackingTable,
  getUserVersion,
  SCHEMA_VERSION,
} from './migration-runner';
export { INITIAL_MIGRATION } from './0001-initial-schema';
export { ADD_ARTIST_ALBUM_MIGRATION } from './0002-add-artist-album';
