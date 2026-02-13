import { Paths, File, Directory } from 'expo-file-system';
import { kvGet } from '@/src/db/queries';

// KV keys for WebDAV config
export const KV_WEBDAV_URL = 'backup_webdav_url';
export const KV_WEBDAV_USERNAME = 'backup_webdav_username';
export const KV_WEBDAV_PASSWORD = 'backup_webdav_password';

export type BackupStatus = 'not_configured' | 'idle' | 'in_progress' | 'success' | 'failed';
export type BackupResult = 'not_configured' | 'success' | 'failed';

// ─── Listener pattern (same as heartrate.ts) ─────────────────────────

type BackupListener = (status: BackupStatus) => void;

const _listeners = new Set<BackupListener>();
let _status: BackupStatus = 'idle';

export function addBackupListener(listener: BackupListener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

export function getBackupStatus(): BackupStatus {
  return _status;
}

function setStatus(status: BackupStatus): void {
  _status = status;
  for (const l of _listeners) {
    l(status);
  }
}

// ─── Main backup function ────────────────────────────────────────────

const MAX_LOCAL_BACKUPS = 10;

/**
 * Backup the SQLite database.
 *
 * 1. Always creates a local backup in the app's Documents directory.
 * 2. If WebDAV is configured, uploads the snapshot via HTTP PUT.
 *
 * Returns the result so callers can react if needed.
 */
export async function backupDatabase(): Promise<BackupResult> {
  const dbFile = new File(Paths.document, 'SQLite', 'hardwayhome.db');
  if (!dbFile.exists) {
    console.warn('[Backup] Database file not found');
    return 'failed';
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `hardwayhome-${timestamp}.sqlite`;

  // Always do a local backup
  try {
    localBackup(dbFile, filename);
  } catch (err) {
    console.error('[Backup] Local backup failed:', err);
  }

  // WebDAV upload if configured
  const url = kvGet(KV_WEBDAV_URL);
  if (!url) {
    setStatus('not_configured');
    return 'not_configured';
  }

  setStatus('in_progress');

  try {
    await webdavUpload(dbFile, filename, url);
    setStatus('success');
    return 'success';
  } catch (err) {
    console.error('[Backup] WebDAV upload failed:', err);
    setStatus('failed');
    return 'failed';
  }
}

/**
 * Initialize backup status on app launch.
 * Sets to 'not_configured' if no WebDAV URL, 'idle' otherwise.
 */
export function initBackupStatus(): void {
  const url = kvGet(KV_WEBDAV_URL);
  setStatus(url ? 'idle' : 'not_configured');
}

// ─── WebDAV ──────────────────────────────────────────────────────────

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const username = kvGet(KV_WEBDAV_USERNAME);
  const password = kvGet(KV_WEBDAV_PASSWORD);
  if (username) {
    headers['Authorization'] = `Basic ${btoa(`${username}:${password || ''}`)}`;
  }
  return headers;
}

async function webdavUpload(dbFile: File, filename: string, baseUrl: string): Promise<void> {
  // Ensure URL doesn't have trailing slash
  const url = baseUrl.replace(/\/+$/, '');
  const targetUrl = `${url}/${filename}`;

  // Read the database file as a blob via its file:// URI.
  // This avoids base64 encoding and handles binary data correctly.
  const fileResponse = await fetch(dbFile.uri);
  const blob = await fileResponse.blob();

  // HTTP PUT to WebDAV
  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      ...buildAuthHeaders(),
      'Content-Type': 'application/x-sqlite3',
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`WebDAV PUT failed: ${response.status} ${response.statusText}`);
  }

  console.log('[Backup] WebDAV upload succeeded:', targetUrl);
}

/**
 * Test the WebDAV connection with an OPTIONS request.
 * Returns true if the server responds with 2xx.
 */
export async function testWebdavConnection(
  url: string,
  username: string | null,
  password: string | null,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (username) {
      headers['Authorization'] = `Basic ${btoa(`${username}:${password || ''}`)}`;
    }

    const response = await fetch(url.replace(/\/+$/, ''), {
      method: 'OPTIONS',
      headers,
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─── Local backup ────────────────────────────────────────────────────

function localBackup(dbFile: File, filename: string): void {
  const backupDir = new Directory(Paths.document, 'backups');
  if (!backupDir.exists) {
    backupDir.create();
  }

  const backupFile = new File(backupDir, filename);
  dbFile.copy(backupFile);
  console.log('[Backup] Local backup:', backupFile.uri);

  // Prune old local backups
  const contents = backupDir.list();
  const backupFiles = contents
    .filter((item): item is File =>
      item instanceof File &&
      item.name.startsWith('hardwayhome-') &&
      item.name.endsWith('.sqlite')
    )
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const old of backupFiles.slice(MAX_LOCAL_BACKUPS)) {
    old.delete();
  }
}
