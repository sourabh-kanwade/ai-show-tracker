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

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  data?: BackupData;
}

const VALID_STATUSES = new Set(["Plan to Watch", "Watching", "Completed", "Dropped"]);
const VALID_TYPES = new Set(["tv", "movie"]);

/**
 * Validates a candidate JSON payload against the BackupData schema (version 1).
 */
export function validateBackup(json: unknown): BackupValidationResult {
  let parsed: unknown = json;
  if (typeof json === "string") {
    try {
      parsed = JSON.parse(json);
    } catch {
      return { valid: false, error: "Invalid JSON format: unable to parse string" };
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: "Backup data must be an object" };
  }

  const candidate = parsed as Partial<BackupData> & Record<string, unknown>;

  if (candidate.version !== 1) {
    return {
      valid: false,
      error: "Invalid or unsupported backup version. Expected version 1.",
    };
  }

  if (!Array.isArray(candidate.titles)) {
    return {
      valid: false,
      error: "Invalid backup format: 'titles' must be an array.",
    };
  }

  if (!Array.isArray(candidate.episodes)) {
    return {
      valid: false,
      error: "Invalid backup format: 'episodes' must be an array.",
    };
  }

  for (let i = 0; i < candidate.titles.length; i++) {
    const t = candidate.titles[i];
    if (typeof t !== "object" || t === null) {
      return {
        valid: false,
        error: `Invalid title at index ${i}: entry must be an object.`,
      };
    }
    const item = t as unknown as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id) {
      return {
        valid: false,
        error: `Invalid title at index ${i}: missing or invalid required field 'id'.`,
      };
    }
    if (typeof item.name !== "string" || !item.name) {
      return {
        valid: false,
        error: `Invalid title at index ${i}: missing or invalid required field 'name'.`,
      };
    }
    if (typeof item.type !== "string" || !VALID_TYPES.has(item.type)) {
      return {
        valid: false,
        error: `Invalid title at index ${i}: invalid 'type' (expected 'tv' or 'movie').`,
      };
    }
    if (typeof item.status !== "string" || !VALID_STATUSES.has(item.status)) {
      return {
        valid: false,
        error: `Invalid title at index ${i}: invalid 'status' (expected 'Plan to Watch', 'Watching', 'Completed', or 'Dropped').`,
      };
    }
  }

  for (let i = 0; i < candidate.episodes.length; i++) {
    const e = candidate.episodes[i];
    if (typeof e !== "object" || e === null) {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: entry must be an object.`,
      };
    }
    const item = e as unknown as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id) {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'id'.`,
      };
    }
    if (typeof item.titleId !== "string" || !item.titleId) {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'titleId'.`,
      };
    }
    if (typeof item.seasonNumber !== "number" || isNaN(item.seasonNumber)) {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'seasonNumber'.`,
      };
    }
    if (typeof item.episodeNumber !== "number" || isNaN(item.episodeNumber)) {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'episodeNumber'.`,
      };
    }
    if (typeof item.name !== "string") {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'name'.`,
      };
    }
    if (typeof item.isWatched !== "boolean") {
      return {
        valid: false,
        error: `Invalid episode at index ${i}: missing or invalid required field 'isWatched'.`,
      };
    }
  }

  return {
    valid: true,
    data: candidate as unknown as BackupData,
  };
}

export interface ImportBackupOptions {
  overwrite?: boolean;
}

export interface ImportBackupResult {
  titlesCount: number;
  episodesCount: number;
}

/**
 * Restores titles and episodes from a BackupData payload into Dexie IndexedDB.
 */
export async function importBackup(
  backupData: BackupData,
  storeOrDb: TrackerStore | ShowTrackerDB = trackerStore,
  options: ImportBackupOptions = { overwrite: true }
): Promise<ImportBackupResult> {
  const validation = validateBackup(backupData);
  if (!validation.valid || !validation.data) {
    throw new Error(validation.error || "Invalid backup data");
  }

  const validData = validation.data;
  const db = storeOrDb instanceof TrackerStore ? storeOrDb.db : storeOrDb;

  await db.transaction("rw", db.titles, db.episodes, async () => {
    if (options.overwrite !== false) {
      await db.titles.clear();
      await db.episodes.clear();
      if (validData.titles.length > 0) {
        await db.titles.bulkAdd(validData.titles);
      }
      if (validData.episodes.length > 0) {
        await db.episodes.bulkAdd(validData.episodes);
      }
    } else {
      if (validData.titles.length > 0) {
        await db.titles.bulkPut(validData.titles);
      }
      if (validData.episodes.length > 0) {
        await db.episodes.bulkPut(validData.episodes);
      }
    }
  });

  return {
    titlesCount: validData.titles.length,
    episodesCount: validData.episodes.length,
  };
}

