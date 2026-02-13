import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES, SCHEMA_VERSION } from './schema';

const DB_NAME = 'hardwayhome.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the shared database connection for the main (foreground) app context.
 * Initializes on first call with WAL mode and schema creation.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
    _db.execSync('PRAGMA journal_mode = WAL;');
    _db.execSync('PRAGMA foreign_keys = ON;');
    migrate(_db);
  }
  return _db;
}

/**
 * Open a fresh database connection — used by background tasks
 * that run in a separate JS context and can't share the foreground connection.
 */
export function openFreshDatabase(): SQLite.SQLiteDatabase {
  const db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

function migrate(db: SQLite.SQLiteDatabase): void {
  const result = db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    db.execSync(CREATE_TABLES);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}

/** Get the path to the database file on disk (for iCloud backup). */
export function getDatabasePath(): string {
  // expo-sqlite stores databases in the app's documents directory
  // The actual path can be retrieved from the database pragma
  const db = getDatabase();
  const result = db.getFirstSync<{ file: string }>(
    "PRAGMA database_list;"
  );
  return result?.file ?? '';
}
