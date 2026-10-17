import type { Title, EpisodeRecord } from "./types";
import { TrackerStore, trackerStore } from "./store";
import { ShowTrackerDB } from "./db";

export interface BackupData {
  version: 1;
  exportedAt: string;
  titles: Title[];
  episodes: EpisodeRecord[];
}

/**
 * Returns the default backup filename based on the exported date or a fallback date.
 * Format: `show-tracker-backup-YYYY-MM-DD.json`
 */
export function getBackupFilename(backup?: BackupData, date: Date = new Date()): string {
  if (backup?.exportedAt) {
    try {
      const parsed = new Date(backup.exportedAt);
      if (!isNaN(parsed.getTime())) {
        return `show-tracker-backup-${parsed.toISOString().slice(0, 10)}.json`;
      }
    } catch {
      // fallback if unparseable
    }
  }
  return `show-tracker-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Gathers all titles and episodes from the TrackerStore (or ShowTrackerDB)
 * and returns a typed BackupData payload.
 */
export async function exportBackup(
  storeOrDb: TrackerStore | ShowTrackerDB = trackerStore
): Promise<BackupData> {
  const db = storeOrDb instanceof TrackerStore ? storeOrDb.db : storeOrDb;
  const [titles, episodes] = await Promise.all([
    db.titles.toArray(),
    db.episodes.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    titles,
    episodes,
  };
}

/**
 * Helper to trigger a browser file download of the JSON backup.
 */
export function downloadBackupJson(backup: BackupData, filename?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadName = filename ?? getBackupFilename(backup);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
