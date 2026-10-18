import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShowDetailModal } from "./ShowDetailModal";
import { ShowTrackerDB, TrackerStore } from "../lib/store";
import type { Title } from "../lib/types";

describe("ShowDetailModal Component", () => {
  let db: ShowTrackerDB;
  let store: TrackerStore;
  let mockTitle: Title;

  beforeEach(async () => {
    const dbName = `test-detail-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);

    const created = await store.addTitle({
      name: "Severance",
      type: "tv",
      overview: "Mark leads a team of office workers whose memories have been surgically divided.",
      posterUrl: "https://example.com/severance.jpg",
      backdropUrl: "https://example.com/severance-bg.jpg",
      status: "Watching",
      genres: ["Drama", "Sci-Fi", "Mystery"],
      firstAirDate: "2022-02-18",
      totalEpisodes: 9,
      watchedEpisodes: 3,
      rating: 8,
      notes: "Mind-bending mystery show. Need to rewatch episode 4.",
    });

    mockTitle = created;
  });

  afterEach(async () => {
    await db.delete();
  });

  it("does not render when isOpen is false", () => {
    render(
      <ShowDetailModal
        isOpen={false}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders show details: title, poster, premier date, genres, and synopsis", () => {
    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Title
    expect(
      screen.getByRole("heading", { name: "Severance" })
    ).toBeInTheDocument();

    // Poster
    const poster = screen.getByAltText("Severance");
    expect(poster).toBeInTheDocument();
    expect(poster).toHaveAttribute("src", "https://example.com/severance.jpg");

    // Backdrop artwork
    const backdrop = screen.getByTestId("show-backdrop");
    expect(backdrop).toBeInTheDocument();

    // Premier date
    expect(screen.getByText(/2022-02-18/i)).toBeInTheDocument();

    // Genres
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("Mystery")).toBeInTheDocument();

    // Synopsis / Overview
    expect(
      screen.getByText(/mark leads a team of office workers/i)
    ).toBeInTheDocument();
  });

  it("renders fallback poster placeholder when posterUrl is null", async () => {
    const titleWithoutPoster = await store.addTitle({
      name: "No Poster Show",
      type: "tv",
      overview: "A show without poster artwork.",
      status: "Plan to Watch",
      posterUrl: null,
      backdropUrl: null,
      genres: ["Comedy"],
      firstAirDate: "2024-01-01",
    });

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={titleWithoutPoster}
        store={store}
      />
    );

    expect(screen.getByLabelText(/no poster available/i)).toBeInTheDocument();
  });

  it("closes modal on close button click, backdrop click, or Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={onClose}
        title={mockTitle}
        store={store}
      />
    );

    // 1. Close button click
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // 2. Backdrop click
    const backdropOverlay = screen.getByTestId("modal-backdrop-overlay");
    await user.click(backdropOverlay);
    expect(onClose).toHaveBeenCalledTimes(2);

    // 3. Escape key press
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("allows switching watch status among Plan to Watch, Watching, Completed, Dropped and persists to IndexedDB", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
        onStatusChange={onStatusChange}
      />
    );

    // Check current status
    const statusSelect = screen.getByLabelText(/watch status/i) as HTMLSelectElement;
    expect(statusSelect.value).toBe("Watching");

    // Change to "Completed"
    await user.selectOptions(statusSelect, "Completed");

    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.status).toBe("Completed");
    });

    expect(onStatusChange).toHaveBeenCalledWith("Completed");

    // Also verify status button/pill interaction if present
    const droppedBtn = screen.getByRole("button", { name: "Dropped" });
    await user.click(droppedBtn);

    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.status).toBe("Dropped");
    });
    expect(onStatusChange).toHaveBeenCalledWith("Dropped");
  });

  it("allows selecting a 1–10 rating and persists rating to IndexedDB", async () => {
    const user = userEvent.setup();
    const onRatingChange = vi.fn();

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
        onRatingChange={onRatingChange}
      />
    );

    // Current rating is 8
    expect(screen.getByText("8 / 10")).toBeInTheDocument();

    // Click rating 10
    const star10 = screen.getByRole("button", { name: "Rate 10 out of 10" });
    await user.click(star10);

    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.rating).toBe(10);
      expect(screen.getByText("10 / 10")).toBeInTheDocument();
    });

    expect(onRatingChange).toHaveBeenCalledWith(10);

    // Clear rating
    const clearBtn = screen.getByRole("button", { name: /clear rating/i });
    await user.click(clearBtn);

    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.rating).toBeNull();
      expect(screen.getByText(/not rated/i)).toBeInTheDocument();
    });

    expect(onRatingChange).toHaveBeenCalledWith(null);
  });

  it("debounces personal notes autosave and persists to IndexedDB", async () => {
    const user = userEvent.setup();
    const onNotesChange = vi.fn();

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
        debounceMs={100}
        onNotesChange={onNotesChange}
      />
    );

    const notesTextarea = screen.getByLabelText(/personal notes/i) as HTMLTextAreaElement;
    expect(notesTextarea.value).toBe("Mind-bending mystery show. Need to rewatch episode 4.");

    // Clear and type new notes
    await user.clear(notesTextarea);
    await user.type(notesTextarea, "Season finale was incredible!");

    // Saving indicator appears
    expect(screen.getByText(/saving/i)).toBeInTheDocument();

    // Wait for debounce autosave
    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.notes).toBe("Season finale was incredible!");
    }, { timeout: 2000 });

    expect(screen.getByText(/saved/i)).toBeInTheDocument();
    expect(onNotesChange).toHaveBeenCalledWith("Season finale was incredible!");
  });

  it("flushes unsaved notes immediately on textarea blur", async () => {
    const user = userEvent.setup();
    const onNotesChange = vi.fn();

    render(
      <ShowDetailModal
        isOpen={true}
        onClose={vi.fn()}
        title={mockTitle}
        store={store}
        debounceMs={10000} // long debounce
        onNotesChange={onNotesChange}
      />
    );

    const notesTextarea = screen.getByLabelText(/personal notes/i);
    await user.type(notesTextarea, " Updated note.");

    // Immediately blur without waiting 10s
    fireEvent.blur(notesTextarea);

    await waitFor(async () => {
      const updated = await store.db.titles.get(mockTitle.id);
      expect(updated?.notes).toBe("Mind-bending mystery show. Need to rewatch episode 4. Updated note.");
    });
  });

  describe("Interactive Season & Episode Checklist", () => {
    let episodicShow: Title;

    beforeEach(async () => {
      episodicShow = await store.addTitle(
        {
          name: "Succession",
          type: "tv",
          overview: "The Roy family is known for controlling the biggest media company.",
          posterUrl: "https://example.com/succession.jpg",
          status: "Watching",
          totalEpisodes: 4,
          watchedEpisodes: 1,
        },
        [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: "Celebration",
            airDate: "2018-06-03",
            isWatched: true,
          },
          {
            seasonNumber: 1,
            episodeNumber: 2,
            name: "Shit Show at the Tit Factory",
            airDate: "2018-06-10",
            isWatched: false,
          },
          {
            seasonNumber: 2,
            episodeNumber: 1,
            name: "The Summer Palace",
            airDate: "2019-08-11",
            isWatched: false,
          },
          {
            seasonNumber: 2,
            episodeNumber: 2,
            name: "Vaulter",
            airDate: "2019-08-18",
            isWatched: false,
          },
        ]
      );
    });

    it("renders overall show progress bar and next episode tag", async () => {
      render(
        <ShowDetailModal
          isOpen={true}
          onClose={vi.fn()}
          title={episodicShow}
          store={store}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "25");
      expect(screen.getByText(/1 \/ 4 eps \(25%\)/i)).toBeInTheDocument();

      // Next episode tag should indicate S01E02
      expect(screen.getByTestId("next-episode-tag")).toBeInTheDocument();
      expect(screen.getByTestId("next-episode-tag")).toHaveTextContent("S01E02");
    });

    it("renders season selector tabs displaying episode counts and completion ratio per season", async () => {
      const user = userEvent.setup();

      render(
        <ShowDetailModal
          isOpen={true}
          onClose={vi.fn()}
          title={episodicShow}
          store={store}
        />
      );

      // Season tabs
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /Season 1 \(1\/2\)/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("tab", { name: /Season 2 \(0\/2\)/i })).toBeInTheDocument();

      // Season 1 is active by default: shows Season 1 episodes
      expect(screen.getByText("Celebration")).toBeInTheDocument();
      expect(screen.getByText("Shit Show at the Tit Factory")).toBeInTheDocument();
      expect(screen.queryByText("The Summer Palace")).not.toBeInTheDocument();

      // Switch to Season 2 tab
      const season2Tab = screen.getByRole("tab", { name: /Season 2 \(0\/2\)/i });
      await user.click(season2Tab);

      // Shows Season 2 episodes
      expect(screen.getByText("The Summer Palace")).toBeInTheDocument();
      expect(screen.getByText("Vaulter")).toBeInTheDocument();
      expect(screen.queryByText("Celebration")).not.toBeInTheDocument();
    });

    it("renders episode checklist with episode number, name, air date, and checkbox", async () => {
      render(
        <ShowDetailModal
          isOpen={true}
          onClose={vi.fn()}
          title={episodicShow}
          store={store}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Celebration")).toBeInTheDocument();
      });

      // Episode 1 details
      expect(screen.getByText(/Episode 1/i)).toBeInTheDocument();
      expect(screen.getByText("Celebration")).toBeInTheDocument();
      expect(screen.getByText("2018-06-03")).toBeInTheDocument();

      // Checkbox 1 is checked
      const ep1Checkbox = screen.getByRole("checkbox", { name: /Episode 1/i });
      expect(ep1Checkbox).toBeChecked();

      // Episode 2 details
      expect(screen.getByText(/Episode 2/i)).toBeInTheDocument();
      expect(screen.getByText("Shit Show at the Tit Factory")).toBeInTheDocument();
      expect(screen.getByText("2018-06-10")).toBeInTheDocument();

      // Checkbox 2 is unchecked
      const ep2Checkbox = screen.getByRole("checkbox", { name: /Episode 2/i });
      expect(ep2Checkbox).not.toBeChecked();
    });

    it("toggles episode watched state, updates IndexedDB, and recomputes progress bar and next episode tag", async () => {
      const user = userEvent.setup();

      render(
        <ShowDetailModal
          isOpen={true}
          onClose={vi.fn()}
          title={episodicShow}
          store={store}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Celebration")).toBeInTheDocument();
      });

      // Toggle Episode 2 to watched
      const ep2Checkbox = screen.getByRole("checkbox", { name: /Episode 2/i });
      await user.click(ep2Checkbox);

      // Wait for progress bar to update to 50%
      await waitFor(() => {
        const progressbar = screen.getByRole("progressbar");
        expect(progressbar).toHaveAttribute("aria-valuenow", "50");
      });
      expect(screen.getByText(/2 \/ 4 eps \(50%\)/i)).toBeInTheDocument();

      // Next episode tag should now point to S02E01
      expect(screen.getByTestId("next-episode-tag")).toHaveTextContent("S02E01");

      // Season 1 tab reflects (2/2)
      expect(screen.getByRole("tab", { name: /Season 1 \(2\/2\)/i })).toBeInTheDocument();

      // Verify DB persistence
      const episodesInDb = await store.getEpisodes(episodicShow.id);
      expect(episodesInDb[1].isWatched).toBe(true);
      const titleInDb = await store.db.titles.get(episodicShow.id);
      expect(titleInDb?.watchedEpisodes).toBe(2);

      // Uncheck Episode 1
      const ep1Checkbox = screen.getByRole("checkbox", { name: /Episode 1/i });
      await user.click(ep1Checkbox);

      // Progress bar updates back to 25% and next episode tag is S01E01
      await waitFor(() => {
        const progressbar = screen.getByRole("progressbar");
        expect(progressbar).toHaveAttribute("aria-valuenow", "25");
      });
      expect(screen.getByTestId("next-episode-tag")).toHaveTextContent("S01E01");
    });

    it("allows batch marking a season as watched and unwatched using 'Mark Season as Watched' button", async () => {
      const user = userEvent.setup();

      render(
        <ShowDetailModal
          isOpen={true}
          onClose={vi.fn()}
          title={episodicShow}
          store={store}
        />
      );

      // Switch to Season 2 (which has 0/2 watched)
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /Season 2 \(0\/2\)/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole("tab", { name: /Season 2 \(0\/2\)/i }));

      // Click "Mark Season as Watched"
      const markSeasonBtn = screen.getByRole("button", { name: /mark season as watched/i });
      await user.click(markSeasonBtn);

      // Season 2 episodes become watched (1 watched from S1 + 2 watched from S2 = 3/4 = 75%)
      await waitFor(() => {
        const progressbar = screen.getByRole("progressbar");
        expect(progressbar).toHaveAttribute("aria-valuenow", "75");
      });
      expect(screen.getByRole("tab", { name: /Season 2 \(2\/2\)/i })).toBeInTheDocument();

      // Verify DB persistence
      const episodesInDb = await store.getEpisodes(episodicShow.id);
      const s2Eps = episodesInDb.filter((e) => e.seasonNumber === 2);
      expect(s2Eps.every((e) => e.isWatched)).toBe(true);

      // Button now says "Mark Season as Unwatched"
      const unmarkSeasonBtn = screen.getByRole("button", { name: /mark season as unwatched/i });
      await user.click(unmarkSeasonBtn);

      // Season 2 episodes become unwatched (1/4 = 25%)
      await waitFor(() => {
        const progressbar = screen.getByRole("progressbar");
        expect(progressbar).toHaveAttribute("aria-valuenow", "25");
      });
      expect(screen.getByRole("tab", { name: /Season 2 \(0\/2\)/i })).toBeInTheDocument();
    });
  });
});
