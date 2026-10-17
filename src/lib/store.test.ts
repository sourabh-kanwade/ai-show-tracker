import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TrackerStore, ShowTrackerDB } from "./store";

describe("TrackerStore", () => {
  let dbName: string;
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    dbName = `test-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("addTitle and getTitle", () => {
    it("adds a TV show with episode records and computes episode counts", async () => {
      const createdTitle = await store.addTitle(
        {
          externalId: 139,
          type: "tv",
          name: "Girls",
          overview: "A comedy series about young women in NYC.",
          posterUrl: "https://example.com/poster.jpg",
          backdropUrl: "https://example.com/backdrop.jpg",
          status: "Watching",
          genres: ["Drama", "Comedy"],
          firstAirDate: "2012-04-15",
          nextAirDate: null,
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
            airDate: "2012-04-15",
            overview: "Hannah gets cut off.",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Vagina Panic",
            airDate: "2012-04-22",
            overview: "Hannah contemplates health.",
            isWatched: false,
          },
          {
            seasonNumber: 2,
            episodeNumber: 1,
            name: "It's About Time",
            airDate: "2013-01-13",
            overview: "Hannah throws a party.",
            isWatched: false,
          },
        ]
      );

      expect(createdTitle.id).toBeDefined();
      expect(createdTitle.name).toBe("Girls");
      expect(createdTitle.totalEpisodes).toBe(3);
      expect(createdTitle.watchedEpisodes).toBe(1);
      expect(createdTitle.createdAt).toBeDefined();
      expect(createdTitle.updatedAt).toBeDefined();

      const fetched = await store.getTitle(createdTitle.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(createdTitle.id);
      expect(fetched?.episodes).toHaveLength(3);
      expect(fetched?.episodes[0].name).toBe("Pilot");
      expect(fetched?.episodes[0].isWatched).toBe(true);
      expect(fetched?.episodes[0].watchedAt).toBeDefined();
      expect(fetched?.episodes[1].isWatched).toBe(false);
      expect(fetched?.episodes[1].watchedAt).toBeNull();

      // Check episodeSummary
      expect(fetched?.episodeSummary).toEqual({
        total: 3,
        watched: 1,
        unwatched: 2,
        nextEpisode: expect.objectContaining({
          seasonNumber: 1,
          episodeNumber: 2,
          name: "Vagina Panic",
        }),
      });
    });

    it("adds a movie without episodes and defaults status to 'Plan to Watch'", async () => {
      const movie = await store.addTitle({
        externalId: "tt0111161",
        type: "movie",
        name: "The Shawshank Redemption",
        overview: "Two imprisoned men bond over a number of years.",
        posterUrl: "https://example.com/shawshank.jpg",
        backdropUrl: null,
        genres: ["Drama", "Crime"],
        firstAirDate: "1994-09-22",
        nextAirDate: null,
        totalEpisodes: 1,
      });

      expect(movie.status).toBe("Plan to Watch");
      expect(movie.totalEpisodes).toBe(1);
      expect(movie.watchedEpisodes).toBe(0);

      const fetched = await store.getTitle(movie.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.episodes).toHaveLength(0);
      expect(fetched?.episodeSummary?.total).toBe(0);
      expect(fetched?.episodeSummary?.nextEpisode).toBeNull();
    });

    it("returns null when getting a non-existent title", async () => {
      const fetched = await store.getTitle("non-existent-id");
      expect(fetched).toBeNull();
    });
  });

  describe("getTitlesByStatus", () => {
    beforeEach(async () => {
      await store.addTitle({
        name: "Show A",
        type: "tv",
        status: "Watching",
        genres: [],
        firstAirDate: null,
        nextAirDate: null,
      });
      await store.addTitle({
        name: "Show B",
        type: "tv",
        status: "Plan to Watch",
        genres: [],
        firstAirDate: null,
        nextAirDate: null,
      });
      await store.addTitle({
        name: "Movie C",
        type: "movie",
        status: "Completed",
        genres: [],
        firstAirDate: null,
        nextAirDate: null,
      });
      await store.addTitle({
        name: "Show D",
        type: "tv",
        status: "Dropped",
        genres: [],
        firstAirDate: null,
        nextAirDate: null,
      });
    });

    it("returns all titles when status filter is omitted", async () => {
      const all = await store.getTitlesByStatus();
      expect(all).toHaveLength(4);
    });

    it("filters titles by specific status", async () => {
      const watching = await store.getTitlesByStatus("Watching");
      expect(watching).toHaveLength(1);
      expect(watching[0].name).toBe("Show A");

      const planToWatch = await store.getTitlesByStatus("Plan to Watch");
      expect(planToWatch).toHaveLength(1);
      expect(planToWatch[0].name).toBe("Show B");

      const completed = await store.getTitlesByStatus("Completed");
      expect(completed).toHaveLength(1);
      expect(completed[0].name).toBe("Movie C");

      const dropped = await store.getTitlesByStatus("Dropped");
      expect(dropped).toHaveLength(1);
      expect(dropped[0].name).toBe("Show D");
    });
  });

  describe("updateTitleStatus", () => {
    it("updates watch status and timestamps", async () => {
      const title = await store.addTitle({
        name: "Stranger Things",
        type: "tv",
        status: "Plan to Watch",
        genres: ["Sci-Fi"],
        firstAirDate: "2016-07-15",
        nextAirDate: null,
      });

      const originalUpdatedAt = title.updatedAt;

      const updated = await store.updateTitleStatus(title.id, "Watching");
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe("Watching");

      const fetched = await store.getTitle(title.id);
      expect(fetched?.status).toBe("Watching");
      expect(new Date(fetched!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it("returns null when updating status for non-existent title", async () => {
      const updated = await store.updateTitleStatus("missing-id", "Completed");
      expect(updated).toBeNull();
    });
  });

  describe("updateTitleRatingAndNotes", () => {
    it("updates rating and notes successfully", async () => {
      const title = await store.addTitle({
        name: "Succession",
        type: "tv",
        status: "Completed",
        genres: ["Drama"],
        firstAirDate: "2018-06-03",
        nextAirDate: null,
      });

      const updated = await store.updateTitleRatingAndNotes(
        title.id,
        9,
        "Incredible writing and season 4 finale."
      );

      expect(updated).not.toBeNull();
      expect(updated?.rating).toBe(9);
      expect(updated?.notes).toBe("Incredible writing and season 4 finale.");

      const fetched = await store.getTitle(title.id);
      expect(fetched?.rating).toBe(9);
      expect(fetched?.notes).toBe("Incredible writing and season 4 finale.");
    });

    it("allows clearing rating with null", async () => {
      const title = await store.addTitle({
        name: "Severance",
        type: "tv",
        status: "Watching",
        rating: 10,
        notes: "Great mystery",
        genres: ["Sci-Fi"],
        firstAirDate: "2022-02-18",
        nextAirDate: null,
      });

      const updated = await store.updateTitleRatingAndNotes(title.id, null);
      expect(updated?.rating).toBeNull();
      // notes should remain untouched when undefined
      expect(updated?.notes).toBe("Great mystery");
    });

    it("validates rating range between 1 and 10", async () => {
      const title = await store.addTitle({
        name: "Dark",
        type: "tv",
        status: "Watching",
        genres: ["Sci-Fi"],
        firstAirDate: null,
        nextAirDate: null,
      });

      await expect(
        store.updateTitleRatingAndNotes(title.id, 0)
      ).rejects.toThrow("Rating must be between 1 and 10");

      await expect(
        store.updateTitleRatingAndNotes(title.id, 11)
      ).rejects.toThrow("Rating must be between 1 and 10");

      await expect(
        store.updateTitleRatingAndNotes(title.id, -2)
      ).rejects.toThrow("Rating must be between 1 and 10");
    });

    it("returns null for non-existent title", async () => {
      const updated = await store.updateTitleRatingAndNotes("no-id", 8, "test");
      expect(updated).toBeNull();
    });
  });

  describe("deleteTitle", () => {
    it("deletes the title and all its associated episodes", async () => {
      const title = await store.addTitle(
        {
          name: "Breaking Bad",
          type: "tv",
          status: "Watching",
          genres: ["Crime"],
          firstAirDate: "2008-01-20",
          nextAirDate: null,
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
            airDate: "2008-01-20",
            overview: "Walter begins his journey.",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Cat's in the Bag...",
            airDate: "2008-01-27",
            overview: "Disposing evidence.",
            isWatched: false,
          },
        ]
      );

      // Verify records exist initially
      expect(await store.getTitle(title.id)).not.toBeNull();
      const episodesBefore = await store.getEpisodes(title.id);
      expect(episodesBefore).toHaveLength(2);

      // Delete title
      await store.deleteTitle(title.id);

      // Verify title and episodes are deleted
      expect(await store.getTitle(title.id)).toBeNull();
      const episodesAfter = await store.getEpisodes(title.id);
      expect(episodesAfter).toHaveLength(0);
    });
  });

  describe("getEpisodes", () => {
    it("returns episodes in sequential season and episode order", async () => {
      const title = await store.addTitle(
        {
          name: "Ted Lasso",
          type: "tv",
          status: "Watching",
          genres: ["Comedy"],
          firstAirDate: "2020-08-14",
          nextAirDate: null,
        },
        [
          {
            seasonNumber: 2,
            episodeNumber: 2,
            name: "Lavender",
            airDate: "2021-07-30",
            overview: "",
            isWatched: false,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Biscuits",
            airDate: "2020-08-14",
            overview: "",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
            airDate: "2020-08-14",
            overview: "",
            isWatched: true,
          },
          {
            seasonNumber: 2,
            episodeNumber: 1,
            name: "Goodbye Earl",
            airDate: "2021-07-23",
            overview: "",
            isWatched: false,
          },
        ]
      );

      const episodes = await store.getEpisodes(title.id);
      expect(episodes.map((e) => `${e.seasonNumber}x${e.episodeNumber}`)).toEqual([
        "1x1",
        "1x2",
        "2x1",
        "2x2",
      ]);
    });
  });

  describe("toggleEpisodeWatched", () => {
    it("toggles episode watched state and updates title watchedEpisodes count", async () => {
      const title = await store.addTitle(
        {
          name: "The Bear",
          type: "tv",
          status: "Watching",
          genres: ["Drama"],
          firstAirDate: "2022-06-23",
          nextAirDate: null,
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "System",
            airDate: "2022-06-23",
            overview: "",
            isWatched: false,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Hands",
            airDate: "2022-06-23",
            overview: "",
            isWatched: false,
          },
        ]
      );

      expect(title.watchedEpisodes).toBe(0);

      const episodes = await store.getEpisodes(title.id);
      const ep1 = episodes[0];
      const ep2 = episodes[1];

      // Mark episode 1 as watched
      const updatedEp1 = await store.toggleEpisodeWatched(ep1.id, true);
      expect(updatedEp1?.isWatched).toBe(true);
      expect(updatedEp1?.watchedAt).toBeDefined();

      let titleAfter = await store.getTitle(title.id);
      expect(titleAfter?.watchedEpisodes).toBe(1);
      expect(titleAfter?.episodeSummary?.watched).toBe(1);
      expect(titleAfter?.episodeSummary?.nextEpisode?.id).toBe(ep2.id);

      // Mark episode 2 as watched
      const updatedEp2 = await store.toggleEpisodeWatched(ep2.id, true);
      expect(updatedEp2?.isWatched).toBe(true);

      titleAfter = await store.getTitle(title.id);
      expect(titleAfter?.watchedEpisodes).toBe(2);
      expect(titleAfter?.episodeSummary?.watched).toBe(2);
      expect(titleAfter?.episodeSummary?.nextEpisode).toBeNull();

      // Unmark episode 1
      const unmarkedEp1 = await store.toggleEpisodeWatched(ep1.id, false);
      expect(unmarkedEp1?.isWatched).toBe(false);
      expect(unmarkedEp1?.watchedAt).toBeNull();

      titleAfter = await store.getTitle(title.id);
      expect(titleAfter?.watchedEpisodes).toBe(1);
      expect(titleAfter?.episodeSummary?.watched).toBe(1);
      expect(titleAfter?.episodeSummary?.nextEpisode?.id).toBe(ep1.id);
    });

    it("returns null when toggling non-existent episode", async () => {
      const result = await store.toggleEpisodeWatched("missing-ep-id", true);
      expect(result).toBeNull();
    });
  });
});
