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

    it("automatically updates title status to 'Completed' when toggling the final remaining unwatched episode to watched", async () => {
      const title = await store.addTitle(
        {
          name: "Succession",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 4,
            episodeNumber: 9,
            name: "Church and State",
            isWatched: true,
          },
          {
            seasonNumber: 4,
            episodeNumber: 10,
            name: "With Open Eyes",
            isWatched: false,
          },
        ]
      );

      const episodes = await store.getEpisodes(title.id);
      const finale = episodes.find((e) => e.episodeNumber === 10)!;

      await store.toggleEpisodeWatched(finale.id, true);

      const fetched = await store.getTitle(title.id);
      expect(fetched?.status).toBe("Completed");
      expect(fetched?.watchedEpisodes).toBe(2);
    });

    it("returns null when toggling non-existent episode", async () => {
      const result = await store.toggleEpisodeWatched("missing-ep-id", true);
      expect(result).toBeNull();
    });
  });

  describe("getActiveWatchingShows", () => {
    it("returns only watching titles with their next unwatched episode", async () => {
      // 1. Add title in "Plan to Watch"
      await store.addTitle({
        name: "Watchlist Show",
        type: "tv",
        status: "Plan to Watch",
      });

      // 2. Add title in "Watching" with 2 episodes, first one watched
      const watchingTitle = await store.addTitle(
        {
          name: "Active Show",
          type: "tv",
          status: "Watching",
          totalEpisodes: 2,
          watchedEpisodes: 1,
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
            name: "Episode 2",
            isWatched: false,
          },
        ]
      );

      // 3. Add title in "Completed"
      await store.addTitle({
        name: "Completed Show",
        type: "tv",
        status: "Completed",
      });

      const activeShows = await store.getActiveWatchingShows();
      expect(activeShows).toHaveLength(1);
      expect(activeShows[0].title.id).toBe(watchingTitle.id);
      expect(activeShows[0].title.name).toBe("Active Show");
      expect(activeShows[0].nextEpisode?.name).toBe("Episode 2");
      expect(activeShows[0].nextEpisode?.seasonNumber).toBe(1);
      expect(activeShows[0].nextEpisode?.episodeNumber).toBe(2);
    });

    it("returns empty array when no titles have Watching status", async () => {
      await store.addTitle({
        name: "Watchlist Show",
        type: "tv",
        status: "Plan to Watch",
      });

      const activeShows = await store.getActiveWatchingShows();
      expect(activeShows).toEqual([]);
    });
  });

  describe("quickIncrement", () => {
    it("marks the next sequential episode in the current season as watched and advances progress", async () => {
      const title = await store.addTitle(
        {
          name: "Severance",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Good News About Hell",
            isWatched: false,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Half Loop",
            isWatched: false,
          },
        ]
      );

      const res = await store.quickIncrement(title.id);
      expect(res).not.toBeNull();
      expect(res?.watchedEpisode?.name).toBe("Good News About Hell");
      expect(res?.watchedEpisode?.seasonNumber).toBe(1);
      expect(res?.watchedEpisode?.episodeNumber).toBe(1);
      expect(res?.watchedEpisode?.isWatched).toBe(true);
      expect(res?.watchedEpisode?.watchedAt).toBeDefined();

      expect(res?.nextEpisode?.name).toBe("Half Loop");
      expect(res?.nextEpisode?.seasonNumber).toBe(1);
      expect(res?.nextEpisode?.episodeNumber).toBe(2);

      expect(res?.title.watchedEpisodes).toBe(1);

      // Verify database persistence
      const fetched = await store.getTitle(title.id);
      expect(fetched?.watchedEpisodes).toBe(1);
      expect(fetched?.episodes[0].isWatched).toBe(true);
      expect(fetched?.episodes[1].isWatched).toBe(false);
      expect(fetched?.episodeSummary.nextEpisode?.name).toBe("Half Loop");
    });

    it("correctly rolls over from Season N Episode X to Season N+1 Episode 1", async () => {
      const title = await store.addTitle(
        {
          name: "Succession",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 9,
            name: "Pre-Nuptial",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 10,
            name: "Nobody Is Ever Missing",
            isWatched: false,
          },
          {
            seasonNumber: 2,
            episodeNumber: 1,
            name: "The Summer Palace",
            isWatched: false,
          },
          {
            seasonNumber: 2,
            episodeNumber: 2,
            name: "Vaulter",
            isWatched: false,
          },
        ]
      );

      // First increment: marks S01E10 as watched, next should roll over to S02E01
      const res1 = await store.quickIncrement(title.id);
      expect(res1?.watchedEpisode?.seasonNumber).toBe(1);
      expect(res1?.watchedEpisode?.episodeNumber).toBe(10);
      expect(res1?.watchedEpisode?.name).toBe("Nobody Is Ever Missing");

      expect(res1?.nextEpisode?.seasonNumber).toBe(2);
      expect(res1?.nextEpisode?.episodeNumber).toBe(1);
      expect(res1?.nextEpisode?.name).toBe("The Summer Palace");
      expect(res1?.title.watchedEpisodes).toBe(2);

      // Second increment: marks S02E01 as watched, next should be S02E02
      const res2 = await store.quickIncrement(title.id);
      expect(res2?.watchedEpisode?.seasonNumber).toBe(2);
      expect(res2?.watchedEpisode?.episodeNumber).toBe(1);
      expect(res2?.watchedEpisode?.name).toBe("The Summer Palace");

      expect(res2?.nextEpisode?.seasonNumber).toBe(2);
      expect(res2?.nextEpisode?.episodeNumber).toBe(2);
      expect(res2?.nextEpisode?.name).toBe("Vaulter");
      expect(res2?.title.watchedEpisodes).toBe(3);
    });

    it("handles the final episode, setting nextEpisode to null", async () => {
      const title = await store.addTitle(
        {
          name: "Fleabag",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 2,
            episodeNumber: 6,
            name: "Episode 6",
            isWatched: false,
          },
        ]
      );

      const res = await store.quickIncrement(title.id);
      expect(res?.watchedEpisode?.name).toBe("Episode 6");
      expect(res?.nextEpisode).toBeNull();
      expect(res?.title.watchedEpisodes).toBe(1);

      // Further call when all are watched
      const resAfter = await store.quickIncrement(title.id);
      expect(resAfter?.watchedEpisode).toBeNull();
      expect(resAfter?.nextEpisode).toBeNull();
      expect(resAfter?.title.watchedEpisodes).toBe(1);
    });

    it("handles titles without episode records (e.g. movies) by incrementing watchedEpisodes", async () => {
      const movie = await store.addTitle({
        name: "Inception",
        type: "movie",
        status: "Watching",
        totalEpisodes: 1,
        watchedEpisodes: 0,
      });

      const res = await store.quickIncrement(movie.id);
      expect(res?.title.watchedEpisodes).toBe(1);
      expect(res?.watchedEpisode).toBeNull();
      expect(res?.nextEpisode).toBeNull();

      // Capped at totalEpisodes
      const resCapped = await store.quickIncrement(movie.id);
      expect(resCapped?.title.watchedEpisodes).toBe(1);
    });

    it("automatically updates title status to 'Completed' and returns isCompleted: true when series finale is watched", async () => {
      const title = await store.addTitle(
        {
          name: "Better Call Saul",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 6,
            episodeNumber: 12,
            name: "Waterworks",
            isWatched: true,
          },
          {
            seasonNumber: 6,
            episodeNumber: 13,
            name: "Saul Gone",
            isWatched: false,
          },
        ]
      );

      const res = await store.quickIncrement(title.id);
      expect(res).not.toBeNull();
      expect(res?.isCompleted).toBe(true);
      expect(res?.title.status).toBe("Completed");
      expect(res?.title.watchedEpisodes).toBe(2);
      expect(res?.watchedEpisode?.name).toBe("Saul Gone");
      expect(res?.nextEpisode).toBeNull();

      // Check persisted state in DB
      const fetched = await store.getTitle(title.id);
      expect(fetched?.status).toBe("Completed");
      expect(fetched?.watchedEpisodes).toBe(2);
    });

    it("keeps status as 'Watching' and returns isCompleted: false when an intermediate episode is watched", async () => {
      const title = await store.addTitle(
        {
          name: "Breaking Bad",
          type: "tv",
          status: "Watching",
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Pilot",
            isWatched: false,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Cat's in the Bag...",
            isWatched: false,
          },
        ]
      );

      const res = await store.quickIncrement(title.id);
      expect(res?.isCompleted).toBe(false);
      expect(res?.title.status).toBe("Watching");

      const fetched = await store.getTitle(title.id);
      expect(fetched?.status).toBe("Watching");
    });

    it("automatically completes movie when watchedEpisodes reaches totalEpisodes", async () => {
      const movie = await store.addTitle({
        name: "Oppenheimer",
        type: "movie",
        status: "Watching",
        totalEpisodes: 1,
        watchedEpisodes: 0,
      });

      const res = await store.quickIncrement(movie.id);
      expect(res?.isCompleted).toBe(true);
      expect(res?.title.status).toBe("Completed");

      const fetched = await store.getTitle(movie.id);
      expect(fetched?.status).toBe("Completed");
    });

    it("returns null for non-existent titleId", async () => {
      const res = await store.quickIncrement("non-existent-id");
      expect(res).toBeNull();
    });
  });

  describe("markSeasonWatched", () => {
    it("marks all episodes of the given season as watched and updates title watchedEpisodes", async () => {
      const title = await store.addTitle(
        {
          name: "Succession",
          type: "tv",
          status: "Watching",
        },
        [
          { seasonNumber: 1, episodeNumber: 1, name: "Celebration", isWatched: false },
          { seasonNumber: 1, episodeNumber: 2, name: "Shit Show at the Tit Factory", isWatched: false },
          { seasonNumber: 1, episodeNumber: 3, name: "Lifeboats", isWatched: false },
          { seasonNumber: 2, episodeNumber: 1, name: "The Summer Palace", isWatched: false },
          { seasonNumber: 2, episodeNumber: 2, name: "Vaulter", isWatched: false },
        ]
      );

      expect(title.watchedEpisodes).toBe(0);

      // Mark season 1 as watched
      const updatedSeason1 = await store.markSeasonWatched(title.id, 1);
      expect(updatedSeason1).toHaveLength(3);
      expect(updatedSeason1.every((ep) => ep.isWatched)).toBe(true);
      expect(updatedSeason1.every((ep) => ep.watchedAt !== null)).toBe(true);

      // Check title watched count and episodes
      const fetched = await store.getTitle(title.id);
      expect(fetched?.watchedEpisodes).toBe(3);
      expect(fetched?.episodeSummary.watched).toBe(3);
      expect(fetched?.episodeSummary.unwatched).toBe(2);
      expect(fetched?.episodeSummary.nextEpisode?.seasonNumber).toBe(2);
      expect(fetched?.episodeSummary.nextEpisode?.episodeNumber).toBe(1);

      // Season 2 episodes remain untouched
      const season2Eps = fetched?.episodes.filter((e) => e.seasonNumber === 2);
      expect(season2Eps?.every((ep) => !ep.isWatched)).toBe(true);
    });

    it("can mark all episodes of a season as unwatched when isWatched is false", async () => {
      const title = await store.addTitle(
        {
          name: "Severance",
          type: "tv",
          status: "Watching",
        },
        [
          { seasonNumber: 1, episodeNumber: 1, name: "Good News About Hell", isWatched: true },
          { seasonNumber: 1, episodeNumber: 2, name: "Half Loop", isWatched: true },
          { seasonNumber: 2, episodeNumber: 1, name: "Episode 1", isWatched: false },
        ]
      );

      expect(title.watchedEpisodes).toBe(2);

      // Mark season 1 as unwatched
      const updatedSeason1 = await store.markSeasonWatched(title.id, 1, false);
      expect(updatedSeason1).toHaveLength(2);
      expect(updatedSeason1.every((ep) => !ep.isWatched)).toBe(true);
      expect(updatedSeason1.every((ep) => ep.watchedAt === null)).toBe(true);

      const fetched = await store.getTitle(title.id);
      expect(fetched?.watchedEpisodes).toBe(0);
      expect(fetched?.episodeSummary.watched).toBe(0);
      expect(fetched?.episodeSummary.nextEpisode?.seasonNumber).toBe(1);
      expect(fetched?.episodeSummary.nextEpisode?.episodeNumber).toBe(1);
    });

    it("returns empty array for non-existent title or season without episodes", async () => {
      const resNonExistentTitle = await store.markSeasonWatched("invalid-id", 1);
      expect(resNonExistentTitle).toEqual([]);

      const title = await store.addTitle({
        name: "Movie Title",
        type: "movie",
      });
      const resNonExistentSeason = await store.markSeasonWatched(title.id, 99);
      expect(resNonExistentSeason).toEqual([]);
    });
  });
});


