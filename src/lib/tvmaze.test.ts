import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchShows,
  getShowWithEpisodes,
  getEpisode,
  stripHtml,
  formatAirDate,
  createDebouncedSearch,
  TVMazeSearchResult,
} from './tvmaze';
import {
  MOCK_SEARCH_RESULTS_PAYLOAD,
  MOCK_SHOW_WITH_EPISODES_PAYLOAD,
  MOCK_ENDED_SHOW_PAYLOAD,
  MOCK_MINIMAL_SHOW_PAYLOAD,
  MOCK_SINGLE_EPISODE_PAYLOAD,
} from './tvmaze.fixtures';

describe('TVMaze API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('stripHtml helper', () => {
    it('removes tags and unescapes standard HTML entities', () => {
      const html = '<p><b>Breaking Bad</b> &amp; <i>Better Call Saul</i> &quot;cool&quot; &#039;show&#039;!</p>';
      expect(stripHtml(html)).toBe(`Breaking Bad & Better Call Saul "cool" 'show'!`);
    });

    it('handles multiple paragraphs and line breaks cleanly', () => {
      const html = '<p>First line.</p><br/><p>Second line.</p>';
      expect(stripHtml(html)).toBe('First line. Second line.');
    });

    it('returns empty string for null, undefined, or empty string', () => {
      expect(stripHtml(null)).toBe('');
      expect(stripHtml(undefined)).toBe('');
      expect(stripHtml('')).toBe('');
      expect(stripHtml('   ')).toBe('');
    });
  });

  describe('formatAirDate helper', () => {
    it('formats ISO air dates to human readable string', () => {
      expect(formatAirDate('2025-01-17')).toBe('Jan 17, 2025');
      expect(formatAirDate('2008-01-20')).toBe('Jan 20, 2008');
    });

    it('returns null for null, undefined, or invalid date string', () => {
      expect(formatAirDate(null)).toBeNull();
      expect(formatAirDate(undefined)).toBeNull();
      expect(formatAirDate('')).toBeNull();
      expect(formatAirDate('invalid-date')).toBeNull();
    });
  });

  describe('searchShows', () => {
    it('calls the TVMaze search endpoint with properly encoded query and returns normalized results', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SEARCH_RESULTS_PAYLOAD,
      } as unknown as Response);

      const results = await searchShows('Severance & Breaking Bad', mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.tvmaze.com/search/shows?q=Severance%20%26%20Breaking%20Bad'
      );
      expect(results).toHaveLength(2);

      const [breakingBad, severance] = results;

      // Check Breaking Bad (Network show)
      expect(breakingBad).toEqual<TVMazeSearchResult>({
        id: 169,
        name: 'Breaking Bad',
        premiered: '2008-01-20',
        ended: '2013-09-29',
        summary: 'Breaking Bad follows protagonist Walter White, a chemistry teacher who is dying of cancer & turns to meth making.',
        image: {
          medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/0/2400.jpg',
          original: 'https://static.tvmaze.com/uploads/images/original_untouched/0/2400.jpg',
        },
        posterUrl: 'https://static.tvmaze.com/uploads/images/medium_portrait/0/2400.jpg',
        genres: ['Drama', 'Crime', 'Thriller'],
        status: 'Ended',
        network: 'AMC',
        webChannel: null,
        networkOrWebChannel: 'AMC',
        rating: 9.2,
        nextAirDate: null,
        nextEpisodeHref: null,
      });

      // Check Severance (WebChannel show with upcoming episode link)
      expect(severance.id).toBe(44458);
      expect(severance.name).toBe('Severance');
      expect(severance.network).toBeNull();
      expect(severance.webChannel).toBe('Apple TV+');
      expect(severance.networkOrWebChannel).toBe('Apple TV+');
      expect(severance.summary).toBe(
        'Mark Scout leads a team at Lumon Industries, whose employees have undergone a severance procedure "severing" their memories.'
      );
      expect(severance.nextEpisodeHref).toBe('https://api.tvmaze.com/episodes/3012941');
    });

    it('returns an empty array immediately without invoking fetch if query is empty or whitespace', async () => {
      const mockFetch = vi.fn();

      const res1 = await searchShows('', mockFetch);
      const res2 = await searchShows('   ', mockFetch);

      expect(res1).toEqual([]);
      expect(res2).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles empty search results from TVMaze', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response);

      const results = await searchShows('nonexistent title 123456789', mockFetch);
      expect(results).toEqual([]);
    });

    it('throws an informative error if the TVMaze API returns an HTTP error status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as unknown as Response);

      await expect(searchShows('The Wire', mockFetch)).rejects.toThrow(
        'TVMaze API error: 503 Service Unavailable'
      );
    });

    it('propagates network rejections from fetch', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      await expect(searchShows('Fargo', mockFetch)).rejects.toThrow('Network failure');
    });
  });

  describe('getShowWithEpisodes', () => {
    it('fetches show with embedded episodes and extracts complete season and episode breakdown', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SHOW_WITH_EPISODES_PAYLOAD,
      } as unknown as Response);

      const show = await getShowWithEpisodes(44458, mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.tvmaze.com/shows/44458?embed=episodes');

      expect(show.id).toBe(44458);
      expect(show.name).toBe('Severance');
      expect(show.status).toBe('Running');
      expect(show.webChannel).toBe('Apple TV+');
      expect(show.seasonsCount).toBe(2);
      expect(show.totalEpisodesCount).toBe(3);
      expect(show.episodes).toHaveLength(3);

      // Verify episode normalization
      const [ep1, ep2, ep3] = show.episodes;
      expect(ep1).toEqual({
        id: 2189447,
        name: 'Good News About Hell',
        season: 1,
        number: 1,
        airdate: '2022-02-18',
        airtime: '00:00',
        airstamp: '2022-02-18T05:00:00+00:00',
        runtime: 57,
        summary: 'Mark Scout leads a team at Lumon Industries.',
        image: {
          medium: 'https://static.tvmaze.com/uploads/images/medium_landscape/400/1000858.jpg',
          original: 'https://static.tvmaze.com/uploads/images/original_untouched/400/1000858.jpg',
        },
        posterUrl: 'https://static.tvmaze.com/uploads/images/medium_landscape/400/1000858.jpg',
      });
      expect(ep2.name).toBe('Half Loop');
      expect(ep3.name).toBe('Goodbye Mrs. Selvig');

      // Verify next episode resolution from _links.nextepisode and embedded episodes
      expect(show.nextAirDate).toBe('2025-01-17');
      expect(show.nextEpisode).toEqual({
        id: 3012941,
        name: 'Goodbye Mrs. Selvig',
        airdate: '2025-01-17',
        airtime: '00:00',
        airstamp: '2025-01-17T05:00:00+00:00',
        season: 2,
        number: 1,
      });
    });

    it('handles ended shows with no upcoming episode gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_ENDED_SHOW_PAYLOAD,
      } as unknown as Response);

      const show = await getShowWithEpisodes(169, mockFetch);

      expect(show.name).toBe('Breaking Bad');
      expect(show.status).toBe('Ended');
      expect(show.nextAirDate).toBeNull();
      expect(show.nextEpisode).toBeNull();
      expect(show.episodes).toHaveLength(2);
      expect(show.seasonsCount).toBe(2); // seasons 1 and 5 in mock
    });

    it('handles minimal shows with null fields and special episodes with null episode number', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_MINIMAL_SHOW_PAYLOAD,
      } as unknown as Response);

      const show = await getShowWithEpisodes(9999, mockFetch);

      expect(show.id).toBe(9999);
      expect(show.name).toBe('Indie Mystery');
      expect(show.image).toBeNull();
      expect(show.posterUrl).toBeNull();
      expect(show.summary).toBe('');
      expect(show.network).toBeNull();
      expect(show.webChannel).toBeNull();
      expect(show.networkOrWebChannel).toBeNull();
      expect(show.nextAirDate).toBeNull();
      expect(show.nextEpisode).toBeNull();
      expect(show.episodes).toHaveLength(1);

      const [ep] = show.episodes;
      expect(ep.number).toBeNull();
      expect(ep.season).toBe(0);
      expect(ep.summary).toBe('');
      expect(ep.image).toBeNull();
      expect(ep.posterUrl).toBeNull();
    });

    it('throws 404 error when show does not exist', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      await expect(getShowWithEpisodes(99999999, mockFetch)).rejects.toThrow(
        'TVMaze API error: 404 Not Found'
      );
    });
  });

  describe('getEpisode', () => {
    it('fetches an individual episode by ID and normalizes the payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SINGLE_EPISODE_PAYLOAD,
      } as unknown as Response);

      const ep = await getEpisode(3012941, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith('https://api.tvmaze.com/episodes/3012941');
      expect(ep.id).toBe(3012941);
      expect(ep.name).toBe('Goodbye Mrs. Selvig');
      expect(ep.season).toBe(2);
      expect(ep.number).toBe(1);
      expect(ep.airdate).toBe('2025-01-17');
    });
  });

  describe('createDebouncedSearch', () => {
    it('debounces rapid search invocations and returns the last query result', async () => {
      vi.useFakeTimers();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SEARCH_RESULTS_PAYLOAD,
      } as unknown as Response);

      const debouncedSearch = createDebouncedSearch(300, mockFetch);

      const p1 = debouncedSearch('b');
      const p2 = debouncedSearch('br');
      const p3 = debouncedSearch('break');

      // Fast-forward timers by 300ms
      await vi.advanceTimersByTimeAsync(300);

      const [res1, res2, results] = await Promise.all([p1, p2, p3]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.tvmaze.com/search/shows?q=break');
      expect(res1).toHaveLength(2);
      expect(res2).toHaveLength(2);
      expect(results).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe('Show with next episode not in embedded array', () => {
    it('populates nextEpisode with href id and name when episode details are not embedded', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 500,
          name: 'Future Show',
          _links: {
            nextepisode: {
              href: 'https://api.tvmaze.com/episodes/98765',
              name: 'Chapter Next',
            },
          },
          _embedded: { episodes: [] },
        }),
      } as unknown as Response);

      const show = await getShowWithEpisodes(500, mockFetch);
      expect(show.nextAirDate).toBeNull();
      expect(show.nextEpisode).toEqual({
        id: 98765,
        name: 'Chapter Next',
        airdate: null,
        airtime: null,
        airstamp: null,
        season: null,
        number: null,
      });
    });
  });

  describe('TVMazeClient class', () => {
    it('delegates search, show details, episode, and debounced search', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/search/shows')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => MOCK_SEARCH_RESULTS_PAYLOAD,
          });
        }
        if (url.includes('/shows/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => MOCK_SHOW_WITH_EPISODES_PAYLOAD,
          });
        }
        if (url.includes('/episodes/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => MOCK_SINGLE_EPISODE_PAYLOAD,
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const client = new (await import('./tvmaze')).TVMazeClient(mockFetch as unknown as typeof fetch);

      const searchResults = await client.searchShows('Severance');
      expect(searchResults).toHaveLength(2);

      const showDetails = await client.getShowWithEpisodes(44458);
      expect(showDetails.name).toBe('Severance');

      const episode = await client.getEpisode(3012941);
      expect(episode.name).toBe('Goodbye Mrs. Selvig');

      const debounced = client.createDebouncedSearch(50);
      expect(typeof debounced).toBe('function');
    });
  });

  describe('Default global fetch fallback', () => {
    it('uses globalThis.fetch if customFetch is omitted', async () => {
      const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SEARCH_RESULTS_PAYLOAD,
      } as Response);

      const results = await searchShows('Test');
      expect(globalFetchSpy).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(2);
    });
  });

  describe('isFutureAirDate helper', () => {
    it('identifies future dates correctly relative to reference date', async () => {
      const { isFutureAirDate } = await import('./tvmaze');
      const refDate = new Date('2026-10-18T12:00:00Z');

      expect(isFutureAirDate('2026-10-19', refDate)).toBe(true);
      expect(isFutureAirDate('2027-05-20', refDate)).toBe(true);
      expect(isFutureAirDate('2026-10-18', refDate)).toBe(true); // Same day airs today
    });

    it('returns false for past dates, invalid strings, or null/undefined', async () => {
      const { isFutureAirDate } = await import('./tvmaze');
      const refDate = new Date('2026-10-18T12:00:00Z');

      expect(isFutureAirDate('2026-10-17', refDate)).toBe(false);
      expect(isFutureAirDate('2020-01-01', refDate)).toBe(false);
      expect(isFutureAirDate(null, refDate)).toBe(false);
      expect(isFutureAirDate(undefined, refDate)).toBe(false);
      expect(isFutureAirDate('invalid-date', refDate)).toBe(false);
      expect(isFutureAirDate('', refDate)).toBe(false);
    });
  });

  describe('getNextAirDateFromSchedule helper', () => {
    it('calculates the next upcoming air date based on scheduled day of week', async () => {
      const { getNextAirDateFromSchedule } = await import('./tvmaze');
      // 2026-10-18 is a Sunday (UTC)
      const sundayRef = new Date('2026-10-18T12:00:00Z');

      // Next Friday is 2026-10-23
      const fridayDate = getNextAirDateFromSchedule(
        { time: '20:00', days: ['Friday'] },
        sundayRef
      );
      expect(fridayDate).toBe('2026-10-23');

      // Scheduled Sunday with time later today (15:00 > 12:00)
      const todaySunday = getNextAirDateFromSchedule(
        { time: '15:00', days: ['Sunday'] },
        sundayRef
      );
      expect(todaySunday).toBe('2026-10-18');

      // Scheduled Sunday with time earlier today (09:00 < 12:00) rolls over to next week (2026-10-25)
      const nextSunday = getNextAirDateFromSchedule(
        { time: '09:00', days: ['Sunday'] },
        sundayRef
      );
      expect(nextSunday).toBe('2026-10-25');
    });

    it('returns null when schedule is empty, days array is missing or empty', async () => {
      const { getNextAirDateFromSchedule } = await import('./tvmaze');
      expect(getNextAirDateFromSchedule(null)).toBeNull();
      expect(getNextAirDateFromSchedule(undefined)).toBeNull();
      expect(getNextAirDateFromSchedule({ days: [] })).toBeNull();
      expect(getNextAirDateFromSchedule({ time: '20:00', days: [] })).toBeNull();
    });
  });

  describe('Upcoming air date extraction in getShowWithEpisodes', () => {
    it('extracts nextAirDate from _links.nextepisode when airdate is provided in the link', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 777,
          name: 'The Diplomat',
          status: 'Running',
          _links: {
            nextepisode: {
              href: 'https://api.tvmaze.com/episodes/999111',
              name: 'The Wire',
              airdate: '2026-11-15',
            },
          },
          _embedded: { episodes: [] },
        }),
      } as unknown as Response);

      const show = await getShowWithEpisodes(777, mockFetch);
      expect(show.nextAirDate).toBe('2026-11-15');
      expect(show.nextEpisode).toEqual({
        id: 999111,
        name: 'The Wire',
        airdate: '2026-11-15',
        airtime: null,
        airstamp: null,
        season: null,
        number: null,
      });
    });

    it('extracts nextAirDate from embedded episode schedule when _links.nextepisode is absent but upcoming episode exists', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 888,
          name: 'Silo',
          status: 'Running',
          _links: {},
          _embedded: {
            episodes: [
              {
                id: 1,
                name: 'Old Ep',
                season: 1,
                number: 1,
                airdate: '2023-05-05',
                airtime: '00:00',
                airstamp: '2023-05-05T00:00:00Z',
              },
              {
                id: 2,
                name: 'Future Ep',
                season: 2,
                number: 1,
                airdate: '2027-01-15',
                airtime: '00:00',
                airstamp: '2027-01-15T00:00:00Z',
              },
            ],
          },
        }),
      } as unknown as Response);

      const show = await getShowWithEpisodes(888, mockFetch);
      expect(show.nextAirDate).toBe('2027-01-15');
      expect(show.nextEpisode?.name).toBe('Future Ep');
    });

    it('extracts nextAirDate from schedule when show is Running and no explicit upcoming episode is given', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 999,
          name: 'Weekly Live Show',
          status: 'Running',
          schedule: { time: '21:00', days: ['Friday'] },
          _links: {},
          _embedded: { episodes: [] },
        }),
      } as unknown as Response);

      const show = await getShowWithEpisodes(999, mockFetch);
      expect(show.nextAirDate).not.toBeNull();
      // Verifies format YYYY-MM-DD
      expect(show.nextAirDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('ensures nextAirDate is null for shows with status Ended even if payload contains schedule or nextepisode link', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 111,
          name: 'Finished Drama',
          status: 'Ended',
          schedule: { time: '22:00', days: ['Sunday'] },
          _links: {
            nextepisode: {
              href: 'https://api.tvmaze.com/episodes/12345',
              airdate: '2028-01-01',
            },
          },
          _embedded: {
            episodes: [
              {
                id: 12345,
                season: 5,
                number: 10,
                airdate: '2028-01-01',
              },
            ],
          },
        }),
      } as unknown as Response);

      const show = await getShowWithEpisodes(111, mockFetch);
      expect(show.status).toBe('Ended');
      expect(show.nextAirDate).toBeNull();
      expect(show.nextEpisode).toBeNull();
    });
  });

  describe('Storage adapter helpers', () => {
    it('toCreateTitleInput maps a TVMaze show or details object to CreateTitleInput', async () => {
      const { toCreateTitleInput } = await import('./tvmaze');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SHOW_WITH_EPISODES_PAYLOAD,
      } as unknown as Response);

      const show = await getShowWithEpisodes(44458, mockFetch);
      const titleInput = toCreateTitleInput(show, 'Watching');

      expect(titleInput).toEqual({
        externalId: 44458,
        type: 'tv',
        name: 'Severance',
        overview:
          'Mark Scout leads a team at Lumon Industries, whose employees have undergone a severance procedure "severing" their memories.',
        posterUrl: 'https://static.tvmaze.com/uploads/images/medium_portrait/520/1301479.jpg',
        status: 'Watching',
        rating: 8.4,
        genres: ['Drama', 'Mystery', 'Science-Fiction'],
        firstAirDate: '2022-02-18',
        nextAirDate: '2025-01-17',
        airingStatus: 'Running',
        totalEpisodes: 3,
      });
    });

    it('toCreateTitleInput sets nextAirDate to null when show has status Ended', async () => {
      const { toCreateTitleInput } = await import('./tvmaze');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_ENDED_SHOW_PAYLOAD,
      } as unknown as Response);

      const show = await getShowWithEpisodes(169, mockFetch);
      const titleInput = toCreateTitleInput(show, 'Completed');

      expect(titleInput.nextAirDate).toBeNull();
      expect(titleInput.airingStatus).toBe('Ended');
    });

    it('toCreateEpisodeInput maps a TVMaze episode to CreateEpisodeInput', async () => {
      const { toCreateEpisodeInput } = await import('./tvmaze');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_SINGLE_EPISODE_PAYLOAD,
      } as unknown as Response);

      const ep = await getEpisode(3012941, mockFetch);
      const epInput = toCreateEpisodeInput(ep, 'title-123');

      expect(epInput).toEqual({
        titleId: 'title-123',
        seasonNumber: 2,
        episodeNumber: 1,
        name: 'Goodbye Mrs. Selvig',
        airDate: '2025-01-17',
        overview: '',
      });
    });
  });
});

