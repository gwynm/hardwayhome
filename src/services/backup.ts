import { Paths, File, Directory } from 'expo-file-system';
import { kvGet } from '@/src/db/queries';
import { getDatabase } from '@/src/db/database';

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
 * Create a complete snapshot of the database using VACUUM INTO.
 * This merges WAL journal data into a standalone file suitable for backup.
 * Returns a File reference to the snapshot in the cache directory.
 */
function createSnapshot(filename: string): File {
  const db = getDatabase();
  const snapshotFile = new File(Paths.cache, filename);

  // Remove previous snapshot with the same name if it exists
  if (snapshotFile.exists) {
    snapshotFile.delete();
  }

  // Convert file:// URI to filesystem path for SQLite's VACUUM INTO
  const snapshotPath = decodeURIComponent(snapshotFile.uri.replace(/^file:\/\//, ''));

  // VACUUM INTO creates a complete, standalone copy with all WAL data merged
  db.execSync(`VACUUM INTO '${snapshotPath}';`);

  return snapshotFile;
}

/**
 * Backup the SQLite database.
 *
 * 1. Always creates a local backup in the app's Documents directory.
 * 2. If WebDAV is configured, uploads the snapshot via HTTP PUT.
 *
 * Returns the result so callers can react if needed.
 */
export async function backupDatabase(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `hardwayhome-${timestamp}.sqlite`;

  let snapshotFile: File;
  try {
    snapshotFile = createSnapshot(filename);
  } catch (err) {
    console.error('[Backup] Failed to create snapshot:', err);
    return 'failed';
  }

  // Always do a local backup (copy snapshot to Documents/backups)
  try {
    localBackup(snapshotFile, filename);
  } catch (err) {
    console.error('[Backup] Local backup failed:', err);
  }

  // WebDAV upload if configured
  const url = kvGet(KV_WEBDAV_URL);
  if (!url) {
    cleanupSnapshot(snapshotFile);
    setStatus('not_configured');
    return 'not_configured';
  }

  setStatus('in_progress');

  try {
    await webdavUpload(snapshotFile, filename, url);
    cleanupSnapshot(snapshotFile);
    setStatus('success');
    return 'success';
  } catch (err) {
    console.error('[Backup] WebDAV upload failed:', err);
    cleanupSnapshot(snapshotFile);
    setStatus('failed');
    return 'failed';
  }
}

function cleanupSnapshot(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch { /* best effort */ }
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

async function webdavUpload(snapshotFile: File, filename: string, baseUrl: string): Promise<void> {
  // Ensure URL doesn't have trailing slash
  const url = baseUrl.replace(/\/+$/, '');
  const targetUrl = `${url}/${filename}`;

  // Read the snapshot file as a blob via its file:// URI.
  const fileResponse = await fetch(snapshotFile.uri);
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
 * Run a full backup with detailed logging for the settings screen.
 * Calls `onLog` for each step so the UI can show progress.
 * Uses the provided credentials (not saved KV values) so you can
 * test before saving.
 */
export async function backupWithLogs(
  urlInput: string,
  usernameInput: string | null,
  passwordInput: string | null,
  onLog: (line: string) => void,
): Promise<boolean> {
  let snapshotFile: File | null = null;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `hardwayhome-${timestamp}.sqlite`;

    onLog('Creating database snapshot (VACUUM INTO)...');
    try {
      snapshotFile = createSnapshot(filename);
      onLog('Snapshot created: ' + snapshotFile.uri);
    } catch (err) {
      onLog('ERROR: Failed to create snapshot: ' + String(err));
      return false;
    }

    // Local backup (copy snapshot to Documents/backups)
    onLog('Creating local backup...');
    try {
      localBackup(snapshotFile, filename);
      onLog('Local backup OK');
    } catch (err) {
      onLog('Local backup failed: ' + String(err));
    }

    // WebDAV
    const url = urlInput.trim();
    if (!url) {
      onLog('No WebDAV URL provided, skipping remote backup.');
      return false;
    }

    const targetUrl = `${url.replace(/\/+$/, '')}/${filename}`;
    onLog('Target URL: ' + targetUrl);

    onLog('Reading snapshot as blob...');
    const fileResponse = await fetch(snapshotFile.uri);
    const blob = await fileResponse.blob();
    onLog(`Blob size: ${blob.size} bytes`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-sqlite3',
    };
    if (usernameInput) {
      headers['Authorization'] = `Basic ${btoa(`${usernameInput}:${passwordInput || ''}`)}`;
      onLog('Auth: Basic (username: ' + usernameInput + ')');
    } else {
      onLog('Auth: none');
    }

    onLog('Sending PUT request...');
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body: blob,
    });

    onLog(`Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch { /* ignore */ }
      if (body) {
        onLog('Response body: ' + body.slice(0, 500));
      }
      onLog('FAILED');
      return false;
    }

    onLog('SUCCESS');
    setStatus('success');
    return true;
  } catch (err) {
    onLog('ERROR: ' + String(err));
    setStatus('failed');
    return false;
  } finally {
    if (snapshotFile) cleanupSnapshot(snapshotFile);
  }
}

// ─── Local backup ────────────────────────────────────────────────────

function localBackup(snapshotFile: File, filename: string): void {
  const backupDir = new Directory(Paths.document, 'backups');
  if (!backupDir.exists) {
    backupDir.create();
  }

  const backupFile = new File(backupDir, filename);
  snapshotFile.copy(backupFile);
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
