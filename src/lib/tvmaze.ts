/**
 * TVMaze REST API client & response normalizer.
 *
 * Provides type-safe access to TV show metadata, episode guides, artwork,
 * and upcoming air dates without requiring external API keys.
 * Conforms to ADR-0001 (client-side browser storage and zero external AI/LLM dependencies).
 */

import type { CreateTitleInput, CreateEpisodeInput, WatchStatus } from './types';

export interface TVMazeImage {
  medium: string | null;
  original: string | null;
}

export interface TVMazeNextEpisode {
  id: number | null;
  name: string | null;
  airdate: string | null;
  airtime?: string | null;
  airstamp?: string | null;
  season: number | null;
  number: number | null;
}

export interface TVMazeSearchResult {
  id: number;
  name: string;
  premiered: string | null;
  ended: string | null;
  summary: string;
  image: TVMazeImage | null;
  posterUrl: string | null;
  genres: string[];
  status: string;
  network: string | null;
  webChannel: string | null;
  networkOrWebChannel: string | null;
  rating: number | null;
  nextAirDate: string | null;
  nextEpisodeHref: string | null;
}

export interface TVMazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number | null;
  airdate: string | null;
  airtime: string;
  airstamp: string | null;
  runtime: number | null;
  summary: string;
  image: TVMazeImage | null;
  posterUrl: string | null;
}

export interface TVMazeShowDetails extends TVMazeSearchResult {
  nextEpisode: TVMazeNextEpisode | null;
  episodes: TVMazeEpisode[];
  seasonsCount: number;
  totalEpisodesCount: number;
}

/**
 * Strips HTML tags and decodes common HTML entities from raw summary text.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-friendly format (e.g. "Jan 17, 2025").
 * Uses UTC timezone to prevent date shifts across time zones.
 */
export function formatAirDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  const [yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export interface RawTVMazeImage {
  medium?: string | null;
  original?: string | null;
}

export interface RawTVMazeNetwork {
  id?: number;
  name?: string;
  country?: { name?: string; code?: string; timezone?: string } | null;
  officialSite?: string | null;
}

export interface RawTVMazeWebChannel {
  id?: number;
  name?: string;
  country?: { name?: string; code?: string; timezone?: string } | null;
  officialSite?: string | null;
}

export interface RawTVMazeLinks {
  self?: { href: string };
  previousepisode?: { href: string; name?: string };
  nextepisode?: { href: string; name?: string; airdate?: string };
}

export interface RawTVMazeEpisode {
  id: number;
  name?: string | null;
  season?: number;
  number?: number | null;
  type?: string;
  airdate?: string | null;
  airtime?: string;
  airstamp?: string | null;
  runtime?: number | null;
  rating?: { average?: number | null };
  image?: RawTVMazeImage | null;
  summary?: string | null;
  _links?: RawTVMazeLinks;
}

export interface RawTVMazeShow {
  id: number;
  name?: string;
  url?: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  ended?: string | null;
  officialSite?: string | null;
  rating?: { average?: number | null } | null;
  network?: RawTVMazeNetwork | null;
  webChannel?: RawTVMazeWebChannel | null;
  image?: RawTVMazeImage | null;
  summary?: string | null;
  updated?: number;
  _links?: RawTVMazeLinks;
  _embedded?: {
    episodes?: RawTVMazeEpisode[];
  };
  nextAirDate?: string | null;
}

export interface RawTVMazeSearchResultItem {
  score: number;
  show: RawTVMazeShow;
}

function normalizeImage(rawImage?: RawTVMazeImage | null): TVMazeImage | null {
  if (!rawImage || typeof rawImage !== 'object') return null;

  const medium = typeof rawImage.medium === 'string' ? rawImage.medium : null;
  const original = typeof rawImage.original === 'string' ? rawImage.original : null;

  if (!medium && !original) return null;
  return { medium, original };
}

function extractPosterUrl(image: TVMazeImage | null): string | null {
  if (!image) return null;
  return image.medium ?? image.original ?? null;
}

function normalizeEpisode(raw: RawTVMazeEpisode): TVMazeEpisode {
  const image = normalizeImage(raw.image);
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    season: typeof raw.season === 'number' ? raw.season : 0,
    number: typeof raw.number === 'number' ? raw.number : null,
    airdate: typeof raw.airdate === 'string' ? raw.airdate : null,
    airtime: typeof raw.airtime === 'string' ? raw.airtime : '',
    airstamp: typeof raw.airstamp === 'string' ? raw.airstamp : null,
    runtime: typeof raw.runtime === 'number' ? raw.runtime : null,
    summary: stripHtml(raw.summary),
    image,
    posterUrl: extractPosterUrl(image),
  };
}

function normalizeShow(raw: RawTVMazeShow): TVMazeSearchResult {
  const image = normalizeImage(raw.image);
  const networkName = raw.network?.name ?? null;
  const webChannelName = raw.webChannel?.name ?? null;

  return {
    id: raw.id,
    name: raw.name ?? '',
    premiered: raw.premiered ?? null,
    ended: raw.ended ?? null,
    summary: stripHtml(raw.summary),
    image,
    posterUrl: extractPosterUrl(image),
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    status: raw.status ?? 'Unknown',
    network: networkName,
    webChannel: webChannelName,
    networkOrWebChannel: networkName ?? webChannelName ?? null,
    rating: typeof raw.rating?.average === 'number' ? raw.rating.average : null,
    nextAirDate: raw.nextAirDate ?? raw._links?.nextepisode?.airdate ?? null,
    nextEpisodeHref: raw._links?.nextepisode?.href ?? null,
  };
}

/**
 * Searches TVMaze shows by query string.
 *
 * @param query Search query text (e.g. "Breaking Bad")
 * @param customFetch Injectable fetch implementation for unit tests
 * @returns Array of normalized search result models
 */
export async function searchShows(
  query: string,
  customFetch: typeof fetch = fetch
): Promise<TVMazeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(trimmed)}`;
  const response = await customFetch(url);

  if (!response.ok) {
    throw new Error(`TVMaze API error: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as RawTVMazeSearchResultItem[]).map((item) => normalizeShow(item.show));
}

/**
 * Fetches show metadata along with embedded episode breakdown and next air date info.
 *
 * @param id TVMaze show identifier
 * @param customFetch Injectable fetch implementation for unit tests
 * @returns Normalized show details with full episode guide
 */
export async function getShowWithEpisodes(
  id: number,
  customFetch: typeof fetch = fetch
): Promise<TVMazeShowDetails> {
  const url = `https://api.tvmaze.com/shows/${id}?embed=episodes`;
  const response = await customFetch(url);

  if (!response.ok) {
    throw new Error(`TVMaze API error: ${response.status} ${response.statusText}`);
  }

  const raw: RawTVMazeShow = await response.json();
  const normalizedShow = normalizeShow(raw);

  const rawEpisodes: RawTVMazeEpisode[] = Array.isArray(raw._embedded?.episodes)
    ? raw._embedded.episodes
    : [];
  const episodes: TVMazeEpisode[] = rawEpisodes.map(normalizeEpisode);

  // Compute unique seasons count
  const seasonsSet = new Set<number>();
  for (const ep of episodes) {
    seasonsSet.add(ep.season);
  }
  const seasonsCount = seasonsSet.size;

  // Resolve next episode & next air date
  let nextAirDate: string | null = null;
  let nextEpisode: TVMazeNextEpisode | null = null;

  if (raw._links?.nextepisode?.href) {
    const nextHref = raw._links.nextepisode.href;
    const match = nextHref.match(/\/episodes\/(\d+)/);
    const nextEpId = match ? parseInt(match[1], 10) : null;

    const matchedEp = nextEpId !== null ? episodes.find((e) => e.id === nextEpId) : null;

    if (matchedEp) {
      nextAirDate = matchedEp.airdate;
      nextEpisode = {
        id: matchedEp.id,
        name: matchedEp.name,
        airdate: matchedEp.airdate,
        airtime: matchedEp.airtime || null,
        airstamp: matchedEp.airstamp,
        season: matchedEp.season,
        number: matchedEp.number,
      };
    } else {
      nextEpisode = {
        id: nextEpId,
        name: raw._links.nextepisode.name ?? null,
        airdate: null,
        airtime: null,
        airstamp: null,
        season: null,
        number: null,
      };
    }
  }

  return {
    ...normalizedShow,
    nextAirDate,
    nextEpisode,
    episodes,
    seasonsCount,
    totalEpisodesCount: episodes.length,
  };
}

/**
 * Fetches an individual episode by its TVMaze ID.
 *
 * @param id TVMaze episode identifier
 * @param customFetch Injectable fetch implementation for unit tests
 * @returns Normalized TVMazeEpisode
 */
export async function getEpisode(
  id: number,
  customFetch: typeof fetch = fetch
): Promise<TVMazeEpisode> {
  const url = `https://api.tvmaze.com/episodes/${id}`;
  const response = await customFetch(url);

  if (!response.ok) {
    throw new Error(`TVMaze API error: ${response.status} ${response.statusText}`);
  }

  const raw: RawTVMazeEpisode = await response.json();
  return normalizeEpisode(raw);
}

/**
 * Helper to debounce TVMaze search requests.
 *
 * @param delayMs Debounce delay in milliseconds (defaults to 300ms)
 * @param customFetch Optional injectable fetch
 * @returns Debounced search function returning Promise<TVMazeSearchResult[]>
 */
export function createDebouncedSearch(
  delayMs = 300,
  customFetch: typeof fetch = fetch
): (query: string) => Promise<TVMazeSearchResult[]> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingResolvers: Array<(results: TVMazeSearchResult[]) => void> = [];
  let pendingRejecters: Array<(err: unknown) => void> = [];

  return (query: string): Promise<TVMazeSearchResult[]> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    return new Promise((resolve, reject) => {
      pendingResolvers.push(resolve);
      pendingRejecters.push(reject);

      timer = setTimeout(async () => {
        const resolvers = [...pendingResolvers];
        const rejecters = [...pendingRejecters];
        pendingResolvers = [];
        pendingRejecters = [];
        timer = null;

        try {
          const results = await searchShows(query, customFetch);
          for (const res of resolvers) {
            res(results);
          }
        } catch (err) {
          for (const rej of rejecters) {
            rej(err);
          }
        }
      }, delayMs);
    });
  };
}

/**
 * Class client wrapper with injected fetch instance.
 */
export class TVMazeClient {
  constructor(private fetchImpl: typeof fetch = fetch) {}

  searchShows(query: string): Promise<TVMazeSearchResult[]> {
    return searchShows(query, this.fetchImpl);
  }

  getShowWithEpisodes(id: number): Promise<TVMazeShowDetails> {
    return getShowWithEpisodes(id, this.fetchImpl);
  }

  getEpisode(id: number): Promise<TVMazeEpisode> {
    return getEpisode(id, this.fetchImpl);
  }

  createDebouncedSearch(delayMs = 300) {
    return createDebouncedSearch(delayMs, this.fetchImpl);
  }
}

/**
 * Maps a TVMaze show or show details object to a CreateTitleInput for TrackerStore.
 */
export function toCreateTitleInput(
  show: TVMazeSearchResult | TVMazeShowDetails,
  watchStatus: WatchStatus = 'Plan to Watch'
): CreateTitleInput {
  return {
    externalId: show.id,
    type: 'tv',
    name: show.name,
    overview: show.summary,
    posterUrl: show.posterUrl,
    status: watchStatus,
    rating: show.rating,
    genres: show.genres,
    firstAirDate: show.premiered,
    nextAirDate: show.nextAirDate,
    totalEpisodes: 'totalEpisodesCount' in show ? show.totalEpisodesCount : 0,
  };
}

/**
 * Maps a TVMaze episode to a CreateEpisodeInput for TrackerStore.
 */
export function toCreateEpisodeInput(
  episode: TVMazeEpisode,
  titleId?: string
): CreateEpisodeInput {
  return {
    titleId,
    seasonNumber: episode.season,
    episodeNumber: episode.number ?? 0,
    name: episode.name,
    airDate: episode.airdate,
    overview: episode.summary,
  };
}
