import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchModal } from "./SearchModal";
import { TrackerStore, ShowTrackerDB } from "../lib/store";
import {
  MOCK_SEARCH_RESULTS_PAYLOAD,
  MOCK_SHOW_WITH_EPISODES_PAYLOAD,
} from "../lib/tvmaze.fixtures";

describe("SearchModal Component", () => {
  let dbName: string;
  let db: ShowTrackerDB;
  let store: TrackerStore;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dbName = `test-search-modal-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);

    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/search/shows?q=")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_SEARCH_RESULTS_PAYLOAD),
        });
      }
      if (url.includes("?embed=episodes")) {
        const isBreakingBad = url.includes("/shows/169");
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...MOCK_SHOW_WITH_EPISODES_PAYLOAD,
              id: isBreakingBad ? 169 : 44458,
              name: isBreakingBad ? "Breaking Bad" : "Severance",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it("does not render modal dialog when isOpen is false", () => {
    render(<SearchModal isOpen={false} onClose={vi.fn()} store={store} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal dialog and search input when isOpen is true", () => {
    render(<SearchModal isOpen={true} onClose={vi.fn()} store={store} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search (tv )?shows/i)
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<SearchModal isOpen={true} onClose={handleClose} store={store} />);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<SearchModal isOpen={true} onClose={handleClose} store={store} />);

    await user.keyboard("{Escape}");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("debounces user input before executing TVMaze search", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Sever");

    // Immediately after typing, fetch should not be called yet due to 300ms debounce
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance timers by 300ms
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/search/shows?q=Sever")
      );
    });

    vi.useRealTimers();
  });

  it("renders search results with poster, title, year, network, rating, genres, and summary", async () => {
    const user = userEvent.setup();

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Breaking");

    // Wait for Breaking Bad result card to appear
    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    // Verify metadata
    expect(screen.getByText(/2008/)).toBeInTheDocument();
    expect(screen.getByText(/AMC/)).toBeInTheDocument();
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
    const breakingBadCard = screen.getByText("Breaking Bad").closest("article")!;
    expect(within(breakingBadCard).getByText("Drama")).toBeInTheDocument();
    expect(within(breakingBadCard).getByText("Crime")).toBeInTheDocument();

    // Verify summary is rendered and stripped of HTML
    expect(
      screen.getByText(/Walter White, a chemistry teacher who is dying of cancer/i)
    ).toBeInTheDocument();

    // Verify poster image
    const poster = screen.getByAltText("Breaking Bad");
    expect(poster).toHaveAttribute(
      "src",
      "https://static.tvmaze.com/uploads/images/medium_portrait/0/2400.jpg"
    );
  });

  it("renders fallback placeholder when posterUrl is null", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            score: 0.8,
            show: {
              id: 9999,
              name: "No Poster Mystery",
              premiered: "2024-01-01",
              summary: "A show without poster artwork.",
              image: null,
              genres: ["Mystery"],
              status: "Running",
              network: { name: "WebNet" },
              rating: { average: null },
            },
          },
        ]),
    });

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Mystery");

    await waitFor(() => {
      expect(screen.getByText("No Poster Mystery")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/no poster available/i)).toBeInTheDocument();
    expect(screen.getByText("No Poster")).toBeInTheDocument();
  });

  it("adds show to Watchlist with status 'Plan to Watch' and provides visual toast feedback", async () => {
    const user = userEvent.setup();

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Breaking");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    const addWatchlistBtn = screen.getAllByRole("button", {
      name: /add to watchlist/i,
    })[0];
    await user.click(addWatchlistBtn);

    // Verify store contains title and episodes
    await waitFor(async () => {
      const titles = await store.getTitlesByStatus("Plan to Watch");
      const breakingBad = titles.find((t) => t.name === "Breaking Bad");
      expect(breakingBad).toBeDefined();
      expect(breakingBad?.totalEpisodes).toBeGreaterThan(0);
      const episodes = await store.getEpisodes(breakingBad!.id);
      expect(episodes.length).toBeGreaterThan(0);
    });

    // Verify visual toast feedback appears
    expect(
      await screen.findByText(/added "Breaking Bad" to watchlist/i)
    ).toBeInTheDocument();

    // Verify the card now displays the "In Watchlist" status badge to prevent duplicate imports
    expect(screen.getByText(/in watchlist/i)).toBeInTheDocument();
  });

  it("starts watching show by fetching full episode guide and persisting with status 'Watching'", async () => {
    const user = userEvent.setup();

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Severance");

    await waitFor(() => {
      expect(screen.getByText("Severance")).toBeInTheDocument();
    });

    const startWatchingBtn = screen.getAllByRole("button", {
      name: /start watching/i,
    })[1]; // Severance is second in MOCK_SEARCH_RESULTS_PAYLOAD
    await user.click(startWatchingBtn);

    // Verify store contains title and episodes
    await waitFor(async () => {
      const titles = await store.getTitlesByStatus("Watching");
      const severance = titles.find((t) => t.name === "Severance");
      expect(severance).toBeDefined();

      const episodes = await store.getEpisodes(severance!.id);
      expect(episodes.length).toBe(3);
    });

    // Verify toast feedback appears
    expect(
      await screen.findByText(/started watching "Severance"/i)
    ).toBeInTheDocument();

    // Verify the card now displays the "Watching" status badge
    expect(screen.getByText(/^watching$/i)).toBeInTheDocument();
  });

  it("shows indicator badge and avoids duplicate imports when a show is already in library", async () => {
    // Pre-populate store with Breaking Bad in "Watching" status
    await store.addTitle({
      externalId: 169,
      type: "tv",
      name: "Breaking Bad",
      status: "Watching",
    });

    const user = userEvent.setup();

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "Breaking");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    // Breaking Bad should show "Watching" badge and NOT have "Add to Watchlist" or "Start Watching" button
    const card = screen.getByText("Breaking Bad").closest("article")!;
    expect(within(card).getByText(/^watching$/i)).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: /add to watchlist/i })
    ).not.toBeInTheDocument();

    // Severance is not in the library, so it should still have "Add to Watchlist"
    expect(
      screen.getByRole("button", { name: /add to watchlist/i })
    ).toBeInTheDocument();
  });

  it("displays empty state when query returns no results", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        store={store}
        customFetch={mockFetch as unknown as typeof fetch}
      />
    );

    const input = screen.getByPlaceholderText(/search (tv )?shows/i);
    await user.type(input, "NonExistentQueryXYZ");

    await waitFor(() => {
      expect(
        screen.getByText(/no shows found for "NonExistentQueryXYZ"/i)
      ).toBeInTheDocument();
    });
  });

  describe("Add Movie Manually", () => {
    it("allows adding a movie manually to the Watchlist (Plan to Watch)", async () => {
      const user = userEvent.setup();
      const onShowAdded = vi.fn();

      render(
        <SearchModal
          isOpen={true}
          onClose={vi.fn()}
          store={store}
          onShowAdded={onShowAdded}
        />
      );

      // Click "Add Movie" button in header
      const addMovieBtn = screen.getByRole("button", { name: /add movie manually/i });
      await user.click(addMovieBtn);

      // Verify form is displayed
      expect(screen.getByTestId("add-movie-form")).toBeInTheDocument();
      expect(screen.getByLabelText(/movie title \*/i)).toBeInTheDocument();

      // Fill in details
      await user.type(screen.getByLabelText(/movie title \*/i), "Inception");
      await user.type(screen.getByLabelText(/release year/i), "2010");
      await user.type(screen.getByLabelText(/genres/i), "Action, Sci-Fi");
      await user.type(screen.getByLabelText(/synopsis/i), "Dream within a dream.");

      // Click "Add to Watchlist"
      const submitBtn = screen.getByRole("button", { name: /add to watchlist/i });
      await user.click(submitBtn);

      // Verify store has the movie
      await waitFor(async () => {
        const titles = await store.getTitlesByStatus("Plan to Watch");
        const inception = titles.find((t) => t.name === "Inception");
        expect(inception).toBeDefined();
        expect(inception?.type).toBe("movie");
        expect(inception?.totalEpisodes).toBe(1);
        expect(inception?.watchedEpisodes).toBe(0);
        expect(inception?.status).toBe("Plan to Watch");
        expect(inception?.genres).toEqual(["Action", "Sci-Fi"]);
        expect(inception?.firstAirDate).toBe("2010-01-01");
        expect(inception?.overview).toBe("Dream within a dream.");
      });

      expect(onShowAdded).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Inception", type: "movie" }),
        "watchlist"
      );

      expect(
        await screen.findByText(/added movie "Inception" to library/i)
      ).toBeInTheDocument();
    });

    it("allows marking a movie as watched directly from the manual add form", async () => {
      const user = userEvent.setup();
      const onShowAdded = vi.fn();

      render(
        <SearchModal
          isOpen={true}
          onClose={vi.fn()}
          store={store}
          onShowAdded={onShowAdded}
        />
      );

      await user.click(screen.getByRole("button", { name: /add movie manually/i }));
      await user.type(screen.getByLabelText(/movie title \*/i), "Interstellar");

      const markWatchedBtn = screen.getByRole("button", { name: /mark as watched/i });
      await user.click(markWatchedBtn);

      await waitFor(async () => {
        const titles = await store.getTitlesByStatus("Completed");
        const movie = titles.find((t) => t.name === "Interstellar");
        expect(movie).toBeDefined();
        expect(movie?.type).toBe("movie");
        expect(movie?.totalEpisodes).toBe(1);
        expect(movie?.watchedEpisodes).toBe(1);
        expect(movie?.status).toBe("Completed");
      });

      expect(onShowAdded).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Interstellar", status: "Completed" }),
        "watching"
      );
    });

    it("pre-fills movie title when triggered from empty search results state", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      render(
        <SearchModal
          isOpen={true}
          onClose={vi.fn()}
          store={store}
          customFetch={mockFetch as unknown as typeof fetch}
        />
      );

      const input = screen.getByPlaceholderText(/search (tv )?shows/i);
      await user.type(input, "Oppenheimer");

      const addFromEmptyBtn = await screen.findByRole("button", {
        name: /add "Oppenheimer" as movie/i,
      });
      await user.click(addFromEmptyBtn);

      expect(screen.getByTestId("add-movie-form")).toBeInTheDocument();
      const titleInput = screen.getByLabelText(/movie title \*/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Oppenheimer");
    });

    it("calls onTitleAdded callback (domain-aligned alias) when a title is added", async () => {
      const user = userEvent.setup();
      const onTitleAdded = vi.fn();

      render(
        <SearchModal
          isOpen={true}
          onClose={vi.fn()}
          store={store}
          onTitleAdded={onTitleAdded}
        />
      );

      await user.click(screen.getByRole("button", { name: /add movie manually/i }));
      await user.type(screen.getByLabelText(/movie title \*/i), "Dune");
      await user.click(screen.getByRole("button", { name: /add to watchlist/i }));

      await waitFor(() => {
        expect(onTitleAdded).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Dune", status: "Plan to Watch" }),
          "watchlist"
        );
      });
    });
  });
});
