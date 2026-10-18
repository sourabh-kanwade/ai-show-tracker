import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrentlyWatchingGrid } from "./CurrentlyWatchingGrid";
import { ShowTrackerDB, TrackerStore } from "../lib/store";

describe("CurrentlyWatchingGrid Component", () => {
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    const dbName = `test-grid-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("renders friendly empty state when no shows are currently being watched", async () => {
    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByText(/no shows currently being watched/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/search for tv shows to start tracking your progress/i)
    ).toBeInTheDocument();
  });

  it("renders active show cards when titles are in 'Watching' status", async () => {
    // Add a show in Watching status with 2 episodes
    await store.addTitle(
      {
        name: "Severance",
        type: "tv",
        status: "Watching",
        posterUrl: "https://example.com/severance.jpg",
        totalEpisodes: 10,
        watchedEpisodes: 2,
      },
      [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Good News About Hell",
          isWatched: true,
        },
        {
          seasonNumber: 1,
          episodeNumber: 2,
          name: "Half Loop",
          isWatched: true,
        },
        {
          seasonNumber: 1,
          episodeNumber: 3,
          name: "In Perpetuity",
          isWatched: false,
        },
      ]
    );

    // Add another show in 'Plan to Watch' status (should not be in this section)
    await store.addTitle({
      name: "Succession",
      type: "tv",
      status: "Plan to Watch",
      totalEpisodes: 39,
      watchedEpisodes: 0,
    });

    render(<CurrentlyWatchingGrid store={store} />);

    // Active show appears
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Severance" })).toBeInTheDocument();
    });

    // Check episode badge and progress
    expect(screen.getByText("S01E03")).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 10 eps \(20%\)/i)).toBeInTheDocument();

    // Plan to Watch show does not appear in Watching grid
    expect(screen.queryByText("Succession")).not.toBeInTheDocument();
  });

  it("reactively updates when a new show starts being watched", async () => {
    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByText(/no shows currently being watched/i)).toBeInTheDocument();
    });

    // Dynamically add a show to Watching
    await act(async () => {
      await store.addTitle({
        name: "Slow Horses",
        type: "tv",
        status: "Watching",
        totalEpisodes: 6,
        watchedEpisodes: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Slow Horses" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/no shows currently being watched/i)).not.toBeInTheDocument();
  });

  it("calls onSelectTitle when a show card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    const created = await store.addTitle({
      name: "The Bear",
      type: "tv",
      status: "Watching",
      totalEpisodes: 8,
      watchedEpisodes: 1,
    });

    render(<CurrentlyWatchingGrid store={store} onSelectTitle={onSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "The Bear" })).toBeInTheDocument();
    });

    const card = screen.getByTestId(`show-card-${created.id}`);
    await user.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: created.id, name: "The Bear" }));
  });

  it("calls store.quickIncrement and reactively advances episode badge and progress when '+1 Episode' is clicked", async () => {
    const user = userEvent.setup();

    const created = await store.addTitle(
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

    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Severance" })).toBeInTheDocument();
    });

    expect(screen.getByText("S01E01")).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 2 eps \(0%\)/i)).toBeInTheDocument();

    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    // Reactively updates to S01E02 and 1 / 2 eps (50%)
    await waitFor(() => {
      expect(screen.getByText("S01E02")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 \/ 2 eps \(50%\)/i)).toBeInTheDocument();

    // Verify DB update
    const fetched = await store.getTitle(created.id);
    expect(fetched?.watchedEpisodes).toBe(1);
    expect(fetched?.episodes[0].isWatched).toBe(true);
  });

  it("handles season rollover when '+1 Episode' is clicked on a season finale", async () => {
    const user = userEvent.setup();

    await store.addTitle(
      {
        name: "Succession",
        type: "tv",
        status: "Watching",
      },
      [
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
      ]
    );

    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Succession" })).toBeInTheDocument();
    });

    expect(screen.getByText("S01E10")).toBeInTheDocument();

    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    // Rolls over to S02E01 reactively
    await waitFor(() => {
      expect(screen.getByText("S02E01")).toBeInTheDocument();
    });
    expect(screen.getByText("The Summer Palace")).toBeInTheDocument();
  });

  it("triggers optional onQuickIncrement callback prop when '+1 Episode' is clicked", async () => {
    const user = userEvent.setup();
    const onQuickIncrement = vi.fn();

    const created = await store.addTitle(
      {
        name: "Slow Horses",
        type: "tv",
        status: "Watching",
      },
      [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Failure's Contagious",
          isWatched: false,
        },
      ]
    );

    render(
      <CurrentlyWatchingGrid
        store={store}
        onQuickIncrement={onQuickIncrement}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Slow Horses" })).toBeInTheDocument();
    });

    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    await waitFor(() => {
      expect(onQuickIncrement).toHaveBeenCalledTimes(1);
    });
    expect(onQuickIncrement).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id, name: "Slow Horses" })
    );
  });

  it("reactively moves show off Currently Watching grid and displays celebration toast when series finale is watched", async () => {
    const user = userEvent.setup();

    const created = await store.addTitle(
      {
        name: "Succession",
        type: "tv",
        status: "Watching",
      },
      [
        {
          seasonNumber: 4,
          episodeNumber: 10,
          name: "With Open Eyes",
          isWatched: false,
        },
      ]
    );

    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Succession" })).toBeInTheDocument();
    });

    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    // Toast appears with celebration message
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("You finished Succession!");
    });

    // The show has reactively moved off the grid
    expect(screen.queryByRole("heading", { level: 3, name: "Succession" })).not.toBeInTheDocument();

    // Since it was the only show, empty state is displayed along with toast
    expect(screen.getByText(/no shows currently being watched/i)).toBeInTheDocument();

    // Verify DB title status is Completed
    const fetched = await store.getTitle(created.id);
    expect(fetched?.status).toBe("Completed");
  });

  it("does not display completion toast when incrementing an intermediate episode", async () => {
    const user = userEvent.setup();

    await store.addTitle(
      {
        name: "Dark",
        type: "tv",
        status: "Watching",
      },
      [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Secrets",
          isWatched: false,
        },
        {
          seasonNumber: 1,
          episodeNumber: 2,
          name: "Lies",
          isWatched: false,
        },
      ]
    );

    render(<CurrentlyWatchingGrid store={store} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Dark" })).toBeInTheDocument();
    });

    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    await waitFor(() => {
      expect(screen.getByText("S01E02")).toBeInTheDocument();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/You finished/i)).not.toBeInTheDocument();
  });
});
