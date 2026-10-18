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
});
