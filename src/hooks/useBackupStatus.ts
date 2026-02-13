import { useState, useEffect } from 'react';
import {
  addBackupListener,
  getBackupStatus,
  type BackupStatus,
} from '@/src/services/backup';

/**
 * Hook that tracks the current backup status.
 * Uses the same listener pattern as useHeartRate so multiple
 * screens stay in sync.
 */
export function useBackupStatus(): BackupStatus {
  const [status, setStatus] = useState<BackupStatus>(getBackupStatus());

  useEffect(() => {
    const unsubscribe = addBackupListener((newStatus) => {
      setStatus(newStatus);
    });

    // Sync in case status changed between render and effect
    setStatus(getBackupStatus());

    return unsubscribe;
  }, []);

  return status;
}
