import { ShowTrackerDB, db as defaultDb } from "./db";
import type {
  Title,
  EpisodeRecord,
  WatchStatus,
  EpisodeSummary,
  TitleWithEpisodes,
  WatchingTitleProgress,
  ActiveShowItem,
  CreateTitleInput,
  CreateEpisodeInput,
} from "./types";

export * from "./types";
export * from "./db";

export function findNextEpisode(episodes: EpisodeRecord[]): EpisodeRecord | null {
  return episodes.find((e) => !e.isWatched) ?? null;
}

export class TrackerStore {
  constructor(public readonly db: ShowTrackerDB = defaultDb) {}

  async addTitle(
    titleInput: CreateTitleInput,
    episodesInput?: CreateEpisodeInput[]
  ): Promise<TitleWithEpisodes> {
    const id = titleInput.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    const preparedEpisodes: EpisodeRecord[] = (episodesInput ?? []).map((ep) => ({
      id: ep.id ?? crypto.randomUUID(),
      titleId: id,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      name: ep.name,
      airDate: ep.airDate ?? null,
      overview: ep.overview ?? "",
      isWatched: ep.isWatched ?? false,
      watchedAt: ep.watchedAt ?? (ep.isWatched ? now : null),
    }));

    const watchedCount = preparedEpisodes.filter((e) => e.isWatched).length;
    const totalCount =
      preparedEpisodes.length > 0
        ? preparedEpisodes.length
        : (titleInput.totalEpisodes ?? (titleInput.type === "movie" ? 1 : 0));

    const title: Title = {
      id,
      externalId: titleInput.externalId ?? null,
      type: titleInput.type,
      name: titleInput.name,
      overview: titleInput.overview ?? "",
      posterUrl: titleInput.posterUrl ?? null,
      backdropUrl: titleInput.backdropUrl ?? null,
      status: titleInput.status ?? "Plan to Watch",
      rating: titleInput.rating ?? null,
      notes: titleInput.notes ?? (titleInput.notes === undefined ? null : titleInput.notes),
      genres: titleInput.genres ?? [],
      firstAirDate: titleInput.firstAirDate ?? null,
      nextAirDate: titleInput.nextAirDate ?? null,
      totalEpisodes: titleInput.totalEpisodes ?? totalCount,
      watchedEpisodes:
        titleInput.watchedEpisodes ??
        (preparedEpisodes.length > 0 ? watchedCount : 0),
      createdAt: titleInput.createdAt ?? now,
      updatedAt: titleInput.updatedAt ?? now,
    };

    await this.db.transaction("rw", this.db.titles, this.db.episodes, async () => {
      await this.db.titles.add(title);
      if (preparedEpisodes.length > 0) {
        await this.db.episodes.bulkAdd(preparedEpisodes);
      }
    });

    const sortedEpisodes = [...preparedEpisodes].sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      return a.episodeNumber - b.episodeNumber;
    });

    const episodeSummary: EpisodeSummary = {
      total: sortedEpisodes.length,
      watched: sortedEpisodes.filter((e) => e.isWatched).length,
      unwatched: sortedEpisodes.filter((e) => !e.isWatched).length,
      nextEpisode: findNextEpisode(sortedEpisodes),
    };

    return {
      ...title,
      episodes: sortedEpisodes,
      episodeSummary,
    };
  }

  async getTitle(id: string): Promise<TitleWithEpisodes | null> {
    const title = await this.db.titles.get(id);
    if (!title) {
      return null;
    }

    const episodes = await this.getEpisodes(id);
    const watched = episodes.filter((e) => e.isWatched).length;
    const total = episodes.length;
    const unwatched = total - watched;
    const nextEpisode = findNextEpisode(episodes);

    return {
      ...title,
      episodes,
      episodeSummary: {
        total,
        watched,
        unwatched,
        nextEpisode,
      },
    };
  }

  async getTitlesByStatus(status?: WatchStatus): Promise<Title[]> {
    if (status) {
      return this.db.titles.where("status").equals(status).toArray();
    }
    return this.db.titles.toArray();
  }

  async updateTitleStatus(id: string, status: WatchStatus): Promise<Title | null> {
    const title = await this.db.titles.get(id);
    if (!title) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    await this.db.titles.update(id, { status, updatedAt });
    return (await this.db.titles.get(id)) ?? null;
  }

  async updateTitleRatingAndNotes(
    id: string,
    rating?: number | null,
    notes?: string | null
  ): Promise<Title | null> {
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 1 || rating > 10) {
        throw new Error("Rating must be between 1 and 10");
      }
    }

    const title = await this.db.titles.get(id);
    if (!title) {
      return null;
    }

    const updates: Partial<Title> = {
      updatedAt: new Date().toISOString(),
    };

    if (rating !== undefined) {
      updates.rating = rating;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    await this.db.titles.update(id, updates);
    return (await this.db.titles.get(id)) ?? null;
  }

  async deleteTitle(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.titles, this.db.episodes, async () => {
      await this.db.episodes.where("titleId").equals(id).delete();
      await this.db.titles.delete(id);
    });
  }

  async getEpisodes(titleId: string): Promise<EpisodeRecord[]> {
    const episodes = await this.db.episodes.where("titleId").equals(titleId).toArray();
    return episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      return a.episodeNumber - b.episodeNumber;
    });
  }

  async toggleEpisodeWatched(
    episodeId: string,
    isWatched: boolean
  ): Promise<EpisodeRecord | null> {
    const episode = await this.db.episodes.get(episodeId);
    if (!episode) {
      return null;
    }

    const now = new Date().toISOString();
    const watchedAt = isWatched ? (episode.watchedAt ?? now) : null;

    let updatedEpisode: EpisodeRecord | null = null;

    await this.db.transaction("rw", this.db.titles, this.db.episodes, async () => {
      await this.db.episodes.update(episodeId, { isWatched, watchedAt });
      updatedEpisode = (await this.db.episodes.get(episodeId)) ?? null;

      // Recalculate title's watchedEpisodes count
      const episodes = await this.db.episodes
        .where("titleId")
        .equals(episode.titleId)
        .toArray();
      const watchedEpisodes = episodes.filter((e) => e.isWatched).length;

      await this.db.titles.update(episode.titleId, {
        watchedEpisodes,
        updatedAt: now,
      });
    });

    return updatedEpisode;
  }

  async getActiveWatchingShows(): Promise<WatchingTitleProgress[]> {
    const titles = await this.db.titles
      .where("status")
      .equals("Watching")
      .toArray();

    titles.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const activeShows: WatchingTitleProgress[] = await Promise.all(
      titles.map(async (title) => {
        const episodes = await this.getEpisodes(title.id);
        const nextEpisode = findNextEpisode(episodes);
        return {
          title,
          nextEpisode,
        };
      })
    );

    return activeShows;
  }
}

export const trackerStore = new TrackerStore();
