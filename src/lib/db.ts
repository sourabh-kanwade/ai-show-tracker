import Dexie, { type Table, type DexieOptions } from "dexie";
import type { Title, EpisodeRecord } from "./types";

export class ShowTrackerDB extends Dexie {
  titles!: Table<Title, string>;
  episodes!: Table<EpisodeRecord, string>;

  constructor(dbName = "ShowTrackerDB", options?: DexieOptions) {
    super(dbName, options);
    this.version(1).stores({
      titles: "id, externalId, type, status, name, createdAt, updatedAt",
      episodes: "id, titleId, [titleId+seasonNumber+episodeNumber], seasonNumber, episodeNumber, isWatched",
    });
  }
}

export const db = new ShowTrackerDB();
