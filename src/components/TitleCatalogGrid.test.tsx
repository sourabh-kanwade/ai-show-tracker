import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TitleCatalogGrid } from "./TitleCatalogGrid";
import { ShowTrackerDB, TrackerStore } from "../lib/store";

describe("TitleCatalogGrid Component", () => {
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    const dbName = `test-catalog-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("Watchlist ('Plan to Watch') Tab", () => {
    it("renders empty state when Watchlist has no titles", async () => {
      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/search to add titles/i)).toBeInTheDocument();
    });

    it("renders saved titles in Watchlist with poster, name, genres and 'Start Watching' button", async () => {
      await store.addTitle({
        name: "Severance",
        type: "tv",
        status: "Plan to Watch",
        posterUrl: "https://example.com/severance.jpg",
        genres: ["Drama", "Sci-Fi"],
        totalEpisodes: 10,
        overview: "Mark leads a team of office workers whose memories have been surgically divided.",
      });

      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Severance" })).toBeInTheDocument();
      });

      expect(screen.getByText("Drama")).toBeInTheDocument();
      expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
      expect(screen.getByText(/10 episodes/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /start watching/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete severance|remove severance/i })).toBeInTheDocument();
    });

    it("clicking 'Start Watching' updates title status to 'Watching'", async () => {
      const user = userEvent.setup();
      const created = await store.addTitle({
        name: "Andor",
        type: "tv",
        status: "Plan to Watch",
        totalEpisodes: 12,
      });

      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Andor" })).toBeInTheDocument();
      });

      const startWatchingBtn = screen.getByRole("button", { name: /start watching/i });
      await user.click(startWatchingBtn);

      await waitFor(async () => {
        const updated = await store.getTitle(created.id);
        expect(updated?.status).toBe("Watching");
      });

      // Should be removed from Watchlist tab reactively
      await waitFor(() => {
        expect(screen.queryByRole("heading", { level: 3, name: "Andor" })).not.toBeInTheDocument();
        expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
      });
    });

    it("clicking 'Start Watching' imports episodes via store.importEpisodesForTitle when show has externalId and no existing episodes", async () => {
      const user = userEvent.setup();
      const importSpy = vi.spyOn(store, "importEpisodesForTitle");

      const created = await store.addTitle({
        name: "Severance",
        type: "tv",
        externalId: 101,
        status: "Plan to Watch",
        totalEpisodes: 0,
      });

      const mockTvmazeShow = {
        id: 101,
        name: "Severance",
        summary: "<p>Office thriller</p>",
        image: null,
        premiered: "2022-02-18",
        genres: ["Drama"],
        status: "Running",
        _embedded: {
          episodes: [
            {
              id: 1001,
              name: "Good News About Hell",
              season: 1,
              number: 1,
              airdate: "2022-02-18",
              summary: "<p>Intro</p>",
            },
          ],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTvmazeShow,
      } as unknown as Response);

      render(
        <TitleCatalogGrid
          status="Plan to Watch"
          store={store}
          customFetch={mockFetch as unknown as typeof fetch}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Severance" })).toBeInTheDocument();
      });

      const startWatchingBtn = screen.getByRole("button", { name: /start watching/i });
      await user.click(startWatchingBtn);

      await waitFor(() => {
        expect(importSpy).toHaveBeenCalledTimes(1);
        expect(importSpy).toHaveBeenCalledWith(
          created.id,
          expect.arrayContaining([
            expect.objectContaining({
              name: "Good News About Hell",
              seasonNumber: 1,
              episodeNumber: 1,
            }),
          ])
        );
      });

      await waitFor(async () => {
        const fetched = await store.getTitle(created.id);
        expect(fetched?.status).toBe("Watching");
        expect(fetched?.totalEpisodes).toBe(1);
      });
    });
  });

  describe("Completed Tab", () => {
    it("renders empty state when Completed has no titles", async () => {
      render(<TitleCatalogGrid status="Completed" store={store} />);

      await waitFor(() => {
        expect(screen.getByText(/no completed titles/i)).toBeInTheDocument();
      });
    });

    it("renders completed titles with rating badge and completion date", async () => {
      await store.addTitle({
        name: "Breaking Bad",
        type: "tv",
        status: "Completed",
        rating: 10,
        totalEpisodes: 62,
        watchedEpisodes: 62,
        updatedAt: "2026-10-15T12:00:00.000Z",
      });

      render(<TitleCatalogGrid status="Completed" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Breaking Bad" })).toBeInTheDocument();
      });

      // Rating badge should be displayed
      expect(screen.getByText(/10\/10/i)).toBeInTheDocument();
      // Should show completed indication
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
      // Should have rewatch or start watching button
      expect(screen.getByRole("button", { name: /rewatch/i })).toBeInTheDocument();
    });

    it("displays 'Unrated' when a completed title has no user rating", async () => {
      await store.addTitle({
        name: "Dark",
        type: "tv",
        status: "Completed",
        rating: null,
        totalEpisodes: 26,
        watchedEpisodes: 26,
      });

      render(<TitleCatalogGrid status="Completed" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Dark" })).toBeInTheDocument();
      });

      expect(screen.getByText(/unrated/i)).toBeInTheDocument();
    });

    it("clicking 'Rewatch' moves completed title back to 'Watching'", async () => {
      const user = userEvent.setup();
      const created = await store.addTitle({
        name: "Succession",
        type: "tv",
        status: "Completed",
        rating: 9,
        totalEpisodes: 39,
        watchedEpisodes: 39,
      });

      render(<TitleCatalogGrid status="Completed" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Succession" })).toBeInTheDocument();
      });

      const rewatchBtn = screen.getByRole("button", { name: /rewatch/i });
      await user.click(rewatchBtn);

      await waitFor(async () => {
        const updated = await store.getTitle(created.id);
        expect(updated?.status).toBe("Watching");
      });
    });
  });

  describe("Dropped Tab", () => {
    it("renders empty state when Dropped has no titles", async () => {
      render(<TitleCatalogGrid status="Dropped" store={store} />);

      await waitFor(() => {
        expect(screen.getByText(/no dropped titles/i)).toBeInTheDocument();
      });
    });

    it("renders dropped titles with progress and 'Resume' action", async () => {
      const user = userEvent.setup();
      const created = await store.addTitle({
        name: "The Idol",
        type: "tv",
        status: "Dropped",
        totalEpisodes: 5,
        watchedEpisodes: 2,
      });

      render(<TitleCatalogGrid status="Dropped" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "The Idol" })).toBeInTheDocument();
      });

      expect(screen.getByText(/2 \/ 5 eps/i)).toBeInTheDocument();
      const resumeBtn = screen.getByRole("button", { name: /resume/i });
      expect(resumeBtn).toBeInTheDocument();

      await user.click(resumeBtn);

      await waitFor(async () => {
        const updated = await store.getTitle(created.id);
        expect(updated?.status).toBe("Watching");
      });
    });
  });

  describe("Delete / Remove Action with Confirmation Prompt", () => {
    it("clicking delete button opens confirmation prompt dialog", async () => {
      const user = userEvent.setup();
      await store.addTitle({
        name: "Obi-Wan Kenobi",
        type: "tv",
        status: "Plan to Watch",
        totalEpisodes: 6,
      });

      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Obi-Wan Kenobi" })).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: /delete obi-wan kenobi|remove obi-wan kenobi/i });
      await user.click(deleteBtn);

      // Confirmation dialog opens
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent(/are you sure you want to remove/i);
      expect(dialog).toHaveTextContent(/obi-wan kenobi/i);
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    });

    it("clicking cancel closes confirmation dialog and does not delete title", async () => {
      const user = userEvent.setup();
      const created = await store.addTitle({
        name: "Loki",
        type: "tv",
        status: "Plan to Watch",
        totalEpisodes: 12,
      });

      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Loki" })).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: /delete loki|remove loki/i });
      await user.click(deleteBtn);

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelBtn);

      // Dialog is dismissed
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

      // Title still exists in DB and grid
      const inDb = await store.getTitle(created.id);
      expect(inDb).not.toBeNull();
      expect(screen.getByRole("heading", { level: 3, name: "Loki" })).toBeInTheDocument();
    });

    it("confirming deletion removes title from IndexedDB via store.deleteTitle(id)", async () => {
      const user = userEvent.setup();
      const created = await store.addTitle(
        {
          name: "Halo",
          type: "tv",
          status: "Dropped",
          totalEpisodes: 9,
          watchedEpisodes: 3,
        },
        [
          { seasonNumber: 1, episodeNumber: 1, name: "Contact", isWatched: true },
          { seasonNumber: 1, episodeNumber: 2, name: "Unbound", isWatched: true },
          { seasonNumber: 1, episodeNumber: 3, name: "Emergence", isWatched: true },
        ]
      );

      render(<TitleCatalogGrid status="Dropped" store={store} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Halo" })).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: /delete halo|remove halo/i });
      await user.click(deleteBtn);

      // Find the confirm button in alertdialog
      const confirmBtn = screen.getByRole("button", { name: /^delete$/i, hidden: false });
      await user.click(confirmBtn);

      // Modal closes
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });

      // Title and episodes are deleted from DB
      await waitFor(async () => {
        const deletedTitle = await store.getTitle(created.id);
        expect(deletedTitle).toBeNull();
      });
      const episodes = await store.getEpisodes(created.id);
      expect(episodes).toHaveLength(0);

      // Reactively disappears from grid and shows empty state
      await waitFor(() => {
        expect(screen.queryByRole("heading", { level: 3, name: "Halo" })).not.toBeInTheDocument();
        expect(screen.getByText(/no dropped titles/i)).toBeInTheDocument();
      });
    });
  });

  describe("Live Queries and Selection", () => {
    it("calls onSelectTitle when clicking a title card", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const created = await store.addTitle({
        name: "Fallout",
        type: "tv",
        status: "Plan to Watch",
        totalEpisodes: 8,
      });

      render(<TitleCatalogGrid status="Plan to Watch" store={store} onSelectTitle={onSelect} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Fallout" })).toBeInTheDocument();
      });

      const card = screen.getByTestId(`catalog-card-${created.id}`);
      await user.click(card);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: created.id, name: "Fallout" }));
    });

    it("reactively updates when a new title is added in the background", async () => {
      render(<TitleCatalogGrid status="Plan to Watch" store={store} />);

      await waitFor(() => {
        expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
      });

      await act(async () => {
        await store.addTitle({
          name: "Shogun",
          type: "tv",
          status: "Plan to Watch",
          totalEpisodes: 10,
        });
      });

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3, name: "Shogun" })).toBeInTheDocument();
      });
      expect(screen.queryByText(/your watchlist is empty/i)).not.toBeInTheDocument();
    });
  });
});
