export type WatchStatus = "Plan to Watch" | "Watching" | "Completed" | "Dropped";

export type TitleType = "tv" | "movie";

export interface Title {
  id: string;
  externalId: string | number | null;
  type: TitleType;
  name: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  status: WatchStatus;
  rating?: number | null;
  notes?: string | null;
  genres: string[];
  firstAirDate: string | null;
  nextAirDate: string | null;
  totalEpisodes: number;
  watchedEpisodes: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeRecord {
  id: string;
  titleId: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  overview: string;
  isWatched: boolean;
  watchedAt: string | null;
}

export interface EpisodeSummary {
  total: number;
  watched: number;
  unwatched: number;
  nextEpisode: EpisodeRecord | null;
}

export interface TitleWithEpisodes extends Title {
  episodes: EpisodeRecord[];
  episodeSummary: EpisodeSummary;
}

export interface WatchingTitleProgress {
  title: Title;
  nextEpisode: EpisodeRecord | null;
}

export type ActiveShowItem = WatchingTitleProgress;

export interface QuickIncrementResult {
  title: Title;
  watchedEpisode: EpisodeRecord | null;
  nextEpisode: EpisodeRecord | null;
  isCompleted: boolean;
}


export interface CreateTitleInput {
  id?: string;
  externalId?: string | number | null;
  type: TitleType;
  name: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  status?: WatchStatus;
  rating?: number | null;
  notes?: string | null;
  genres?: string[];
  firstAirDate?: string | null;
  nextAirDate?: string | null;
  totalEpisodes?: number;
  watchedEpisodes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEpisodeInput {
  id?: string;
  titleId?: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate?: string | null;
  overview?: string;
  isWatched?: boolean;
  watchedAt?: string | null;
}
