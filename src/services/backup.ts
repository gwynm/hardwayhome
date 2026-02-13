import { Paths, File, Directory } from 'expo-file-system';

/**
 * Backup the database file to a location accessible via the iOS Files app.
 *
 * Copies the SQLite file to the app's documents directory with a
 * timestamped name. The files are accessible via Files.app > On My iPhone > Hard Way Home.
 *
 * iCloud Documents integration will be added later (either via
 * @oleg_svetlichnyi/expo-icloud-storage or a custom native module).
 */
export async function backupDatabase(): Promise<void> {
  try {
    const dbFile = new File(Paths.document, 'SQLite', 'hardwayhome.db');
    if (!dbFile.exists) {
      console.warn('[Backup] Database file not found');
      return;
    }

    const backupDir = new Directory(Paths.document, 'backups');
    if (!backupDir.exists) {
      backupDir.create();
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = new File(backupDir, `hardwayhome-${timestamp}.sqlite`);

    dbFile.copy(backupFile);
    console.log('[Backup] Database backed up to', backupFile.uri);

    // Clean up old backups — keep only the last 10
    const contents = backupDir.list();
    const backupFiles = contents
      .filter((item): item is File =>
        item instanceof File &&
        item.name.startsWith('hardwayhome-') &&
        item.name.endsWith('.sqlite')
      )
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const old of backupFiles.slice(10)) {
      old.delete();
    }
  } catch (err) {
    // Backup failure is non-fatal — log and move on
    console.error('[Backup] Failed:', err);
  }
}
