import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ShowTrackerDB, TrackerStore } from "./store";
import { exportBackup, downloadBackupJson, getBackupFilename, type BackupData } from "./backup";

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
});
