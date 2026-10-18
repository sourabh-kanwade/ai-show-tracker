import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ShowTrackerDB, TrackerStore } from "./store";
import {
  exportBackup,
  downloadBackupJson,
  getBackupFilename,
  validateBackup,
  importBackup,
  type BackupData,
} from "./backup";

describe("backup", () => {
  let dbName: string;
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    dbName = `test-backup-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  describe("exportBackup", () => {
    it("returns an empty backup structure with version 1 and timestamp when database has no records", async () => {
      const backup = await exportBackup(store);

      expect(backup.version).toBe(1);
      expect(typeof backup.exportedAt).toBe("string");
      // Check that exportedAt is a valid ISO date
      expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
      expect(backup.titles).toEqual([]);
      expect(backup.episodes).toEqual([]);
    });

    it("gathers all titles and episodes from TrackerStore", async () => {
      await store.addTitle(
        {
          type: "tv",
          name: "Breaking Bad",
          status: "Watching",
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Cat's in the Bag...",
            isWatched: false,
          },
        ]
      );

      await store.addTitle({
        type: "movie",
        name: "Inception",
        status: "Completed",
      });

      const backup = await exportBackup(store);

      expect(backup.version).toBe(1);
      expect(backup.titles).toHaveLength(2);
      expect(backup.episodes).toHaveLength(2);

      const titleNames = backup.titles.map((t) => t.name).sort();
      expect(titleNames).toEqual(["Breaking Bad", "Inception"]);

      const episodeNames = backup.episodes.map((e) => e.name).sort();
      expect(episodeNames).toEqual(["Cat's in the Bag...", "Pilot"]);
    });

    it("accepts a ShowTrackerDB instance directly", async () => {
      await store.addTitle({
        type: "movie",
        name: "Interstellar",
        status: "Plan to Watch",
      });

      const backup = await exportBackup(db);
      expect(backup.titles).toHaveLength(1);
      expect(backup.titles[0].name).toBe("Interstellar");
    });
  });

  describe("getBackupFilename", () => {
    it("generates filename with YYYY-MM-DD from exportedAt", () => {
      const backup: BackupData = {
        version: 1,
        exportedAt: "2026-10-17T14:30:00.000Z",
        titles: [],
        episodes: [],
      };

      const filename = getBackupFilename(backup);
      expect(filename).toBe("show-tracker-backup-2026-10-17.json");
    });

    it("falls back to current date if exportedAt is missing or invalid", () => {
      const mockDate = new Date("2026-05-01T12:00:00.000Z");
      const filename = getBackupFilename(undefined, mockDate);
      expect(filename).toBe("show-tracker-backup-2026-05-01.json");
    });
  });

  describe("downloadBackupJson", () => {
    it("triggers a browser download with JSON content and default filename", () => {
      const backup: BackupData = {
        version: 1,
        exportedAt: "2026-10-17T12:00:00.000Z",
        titles: [
          {
            id: "t1",
            externalId: null,
            type: "movie",
            name: "Dune",
            overview: "Spice",
            posterUrl: null,
            backdropUrl: null,
            status: "Watching",
            genres: ["Sci-Fi"],
            firstAirDate: "2021-10-22",
            nextAirDate: null,
            totalEpisodes: 1,
            watchedEpisodes: 0,
            createdAt: "2026-10-17T12:00:00.000Z",
            updatedAt: "2026-10-17T12:00:00.000Z",
          },
        ],
        episodes: [],
      };

      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-uuid");
      const mockRevokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "a") {
          const a = document.createElementNS("http://www.w3.org/1999/xhtml", "a") as HTMLAnchorElement;
          a.click = clickSpy;
          return a;
        }
        return document.createElement(tagName);
      });

      downloadBackupJson(backup);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const createdBlob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(createdBlob).toBeInstanceOf(Blob);
      expect(createdBlob.type).toBe("application/json");

      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-uuid");
    });

    it("triggers a browser download with a custom filename when provided", () => {
      const backup: BackupData = {
        version: 1,
        exportedAt: "2026-10-17T12:00:00.000Z",
        titles: [],
        episodes: [],
      };

      globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/custom-uuid");
      globalThis.URL.revokeObjectURL = vi.fn();

      let createdAnchor: HTMLAnchorElement | null = null;
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "a") {
          const a = document.createElementNS("http://www.w3.org/1999/xhtml", "a") as HTMLAnchorElement;
          a.click = vi.fn();
          createdAnchor = a;
          return a;
        }
        return document.createElement(tagName);
      });

      downloadBackupJson(backup, "custom-backup.json");

      expect(createdAnchor).not.toBeNull();
      expect(createdAnchor!.download).toBe("custom-backup.json");
    });
  });

  describe("validateBackup", () => {
    it("rejects non-object inputs such as null, undefined, or primitives", () => {
      expect(validateBackup(null)).toEqual({
        valid: false,
        error: "Backup data must be an object",
      });
      expect(validateBackup(undefined)).toEqual({
        valid: false,
        error: "Backup data must be an object",
      });
      expect(validateBackup(123)).toEqual({
        valid: false,
        error: "Backup data must be an object",
      });
      expect(validateBackup("not valid json")).toEqual({
        valid: false,
        error: "Invalid JSON format: unable to parse string",
      });
    });

    it("parses valid JSON string representation of backup data", () => {
      const raw = JSON.stringify({
        version: 1,
        exportedAt: "2026-10-18T12:00:00.000Z",
        titles: [],
        episodes: [],
      });
      const result = validateBackup(raw);
      expect(result.valid).toBe(true);
      expect(result.data?.version).toBe(1);
      expect(result.data?.titles).toEqual([]);
      expect(result.data?.episodes).toEqual([]);
    });

    it("rejects when version is missing or not 1", () => {
      const missingVersion = {
        exportedAt: "2026-10-18T12:00:00.000Z",
        titles: [],
        episodes: [],
      };
      expect(validateBackup(missingVersion)).toEqual({
        valid: false,
        error: "Invalid or unsupported backup version. Expected version 1.",
      });

      const wrongVersion = {
        version: 2,
        titles: [],
        episodes: [],
      };
      expect(validateBackup(wrongVersion)).toEqual({
        valid: false,
        error: "Invalid or unsupported backup version. Expected version 1.",
      });
    });

    it("rejects when titles is missing or not an array", () => {
      expect(
        validateBackup({
          version: 1,
          episodes: [],
        })
      ).toEqual({
        valid: false,
        error: "Invalid backup format: 'titles' must be an array.",
      });

      expect(
        validateBackup({
          version: 1,
          titles: "not-an-array",
          episodes: [],
        })
      ).toEqual({
        valid: false,
        error: "Invalid backup format: 'titles' must be an array.",
      });
    });

    it("rejects when episodes is missing or not an array", () => {
      expect(
        validateBackup({
          version: 1,
          titles: [],
        })
      ).toEqual({
        valid: false,
        error: "Invalid backup format: 'episodes' must be an array.",
      });

      expect(
        validateBackup({
          version: 1,
          titles: [],
          episodes: "not-an-array",
        })
      ).toEqual({
        valid: false,
        error: "Invalid backup format: 'episodes' must be an array.",
      });
    });

    it("rejects when a title item is missing required fields or has invalid values", () => {
      const missingName = {
        version: 1,
        titles: [
          {
            id: "t1",
            type: "tv",
            status: "Watching",
          },
        ],
        episodes: [],
      };
      const resultMissingName = validateBackup(missingName);
      expect(resultMissingName.valid).toBe(false);
      expect(resultMissingName.error).toMatch(/Invalid title at index 0/);

      const invalidStatus = {
        version: 1,
        titles: [
          {
            id: "t1",
            name: "Test",
            type: "tv",
            status: "InvalidStatus",
          },
        ],
        episodes: [],
      };
      const resultInvalidStatus = validateBackup(invalidStatus);
      expect(resultInvalidStatus.valid).toBe(false);
      expect(resultInvalidStatus.error).toMatch(/Invalid title at index 0/);

      const invalidType = {
        version: 1,
        titles: [
          {
            id: "t1",
            name: "Test",
            type: "anime",
            status: "Watching",
          },
        ],
        episodes: [],
      };
      const resultInvalidType = validateBackup(invalidType);
      expect(resultInvalidType.valid).toBe(false);
      expect(resultInvalidType.error).toMatch(/Invalid title at index 0/);
    });

    it("rejects when an episode item is missing required fields or has invalid types", () => {
      const missingWatched = {
        version: 1,
        titles: [],
        episodes: [
          {
            id: "e1",
            titleId: "t1",
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
          },
        ],
      };
      const resultMissingWatched = validateBackup(missingWatched);
      expect(resultMissingWatched.valid).toBe(false);
      expect(resultMissingWatched.error).toMatch(/Invalid episode at index 0/);

      const nonNumericSeason = {
        version: 1,
        titles: [],
        episodes: [
          {
            id: "e1",
            titleId: "t1",
            seasonNumber: "1",
            episodeNumber: 1,
            name: "Pilot",
            isWatched: false,
          },
        ],
      };
      const resultNonNumeric = validateBackup(nonNumericSeason);
      expect(resultNonNumeric.valid).toBe(false);
      expect(resultNonNumeric.error).toMatch(/Invalid episode at index 0/);
    });

    it("successfully validates a valid backup object", () => {
      const validPayload: BackupData = {
        version: 1,
        exportedAt: "2026-10-18T10:00:00.000Z",
        titles: [
          {
            id: "t1",
            externalId: 101,
            type: "tv",
            name: "Severance",
            overview: "Work-life balance",
            posterUrl: "https://example.com/poster.jpg",
            backdropUrl: null,
            status: "Watching",
            rating: 9,
            notes: "Great mystery",
            genres: ["Drama", "Sci-Fi"],
            firstAirDate: "2022-02-18",
            nextAirDate: null,
            totalEpisodes: 9,
            watchedEpisodes: 4,
            createdAt: "2026-10-18T10:00:00.000Z",
            updatedAt: "2026-10-18T10:00:00.000Z",
          },
        ],
        episodes: [
          {
            id: "e1",
            titleId: "t1",
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Good News About Hell",
            airDate: "2022-02-18",
            overview: "Introduction",
            isWatched: true,
            watchedAt: "2026-10-18T10:30:00.000Z",
          },
        ],
      };

      const result = validateBackup(validPayload);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validPayload);
      expect(result.error).toBeUndefined();
    });
  });

  describe("importBackup", () => {
    const sampleBackup: BackupData = {
      version: 1,
      exportedAt: "2026-10-18T12:00:00.000Z",
      titles: [
        {
          id: "backup-t1",
          externalId: 99,
          type: "tv",
          name: "Succession",
          overview: "Family drama",
          posterUrl: "https://example.com/succession.jpg",
          backdropUrl: null,
          status: "Watching",
          rating: 10,
          notes: "Masterpiece",
          genres: ["Drama"],
          firstAirDate: "2018-06-03",
          nextAirDate: null,
          totalEpisodes: 39,
          watchedEpisodes: 10,
          createdAt: "2026-10-18T00:00:00.000Z",
          updatedAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      episodes: [
        {
          id: "backup-e1",
          titleId: "backup-t1",
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Celebration",
          airDate: "2018-06-03",
          overview: "Pilot episode",
          isWatched: true,
          watchedAt: "2026-10-18T01:00:00.000Z",
        },
        {
          id: "backup-e2",
          titleId: "backup-t1",
          seasonNumber: 1,
          episodeNumber: 2,
          name: "Sh*t Show at the Cal-Pet",
          airDate: "2018-06-10",
          overview: "Episode 2",
          isWatched: false,
          watchedAt: null,
        },
      ],
    };

    it("imports titles and episodes into an empty database", async () => {
      const summary = await importBackup(sampleBackup, store);

      expect(summary).toEqual({
        titlesCount: 1,
        episodesCount: 2,
      });

      const dbTitles = await db.titles.toArray();
      const dbEpisodes = await db.episodes.toArray();

      expect(dbTitles).toHaveLength(1);
      expect(dbTitles[0].name).toBe("Succession");
      expect(dbTitles[0].rating).toBe(10);
      expect(dbTitles[0].notes).toBe("Masterpiece");

      expect(dbEpisodes).toHaveLength(2);
      expect(dbEpisodes.map((e) => e.name).sort()).toEqual([
        "Celebration",
        "Sh*t Show at the Cal-Pet",
      ]);
    });

    it("overwrites existing titles and episodes by default", async () => {
      // Prepopulate existing data
      await store.addTitle({
        name: "Existing Show",
        type: "movie",
        status: "Plan to Watch",
      });

      const beforeTitles = await db.titles.toArray();
      expect(beforeTitles).toHaveLength(1);

      await importBackup(sampleBackup, store);

      const afterTitles = await db.titles.toArray();
      expect(afterTitles).toHaveLength(1);
      expect(afterTitles[0].name).toBe("Succession");
    });

    it("merges existing titles when overwrite option is false", async () => {
      await store.addTitle({
        id: "existing-movie",
        name: "Existing Movie",
        type: "movie",
        status: "Plan to Watch",
      });

      await importBackup(sampleBackup, store, { overwrite: false });

      const afterTitles = await db.titles.toArray();
      expect(afterTitles).toHaveLength(2);
      const names = afterTitles.map((t) => t.name).sort();
      expect(names).toEqual(["Existing Movie", "Succession"]);
    });

    it("throws an error when attempting to import an invalid backup", async () => {
      const corruptPayload = {
        version: 2,
        titles: [],
        episodes: [],
      } as unknown as BackupData;

      await expect(importBackup(corruptPayload, store)).rejects.toThrow(
        /Invalid or unsupported backup version/
      );
    });

    it("works when passing ShowTrackerDB instance directly", async () => {
      const summary = await importBackup(sampleBackup, db);
      expect(summary.titlesCount).toBe(1);
      expect(summary.episodesCount).toBe(2);

      const titles = await db.titles.toArray();
      expect(titles).toHaveLength(1);
    });
  });
});
