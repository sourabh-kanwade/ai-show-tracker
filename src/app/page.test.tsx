import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";
import { ShowTrackerDB, TrackerStore } from "../lib/store";

describe("Show Tracker App Shell (Smoke Test)", () => {
  it("renders the application header and branding", () => {
    render(<Page />);
    const heading = screen.getByRole("heading", { level: 1, name: /show tracker/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders the Settings gear button in the header and opens Settings modal on click", async () => {
    const user = userEvent.setup();
    render(<Page />);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    expect(settingsButton).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(settingsButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /data management/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/0 titles/i)).toBeInTheDocument();
    });
  });

  it("renders the primary navigation status tabs", () => {
    render(<Page />);
    expect(screen.getByRole("tab", { name: /watching/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /watchlist/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /completed/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /dropped/i })).toBeInTheDocument();
  });

  it("renders a container for tracked titles with Currently Watching section", async () => {
    render(<Page />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();

    expect(screen.getByRole("region", { name: /currently watching/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/no shows currently being watched/i)).toBeInTheDocument();
    });
  });

  it("opens ShowDetailModal when clicking a show card on the dashboard", async () => {
    const { ShowTrackerDB, TrackerStore } = await import("../lib/store");
    const db = new ShowTrackerDB(`test-page-db-${Math.random().toString(36).substring(2, 9)}`);
    const store = new TrackerStore(db);

    await store.addTitle({
      name: "The White Lotus",
      type: "tv",
      overview: "A sharp social satire following the exploits of various employees and guests at an exclusive Hawaiian resort.",
      posterUrl: "https://example.com/white-lotus.jpg",
      status: "Watching",
      totalEpisodes: 6,
      watchedEpisodes: 2,
      rating: 9,
      notes: "Incredible soundtrack and performances.",
    });

    const user = userEvent.setup();
    render(<Page store={store} />);

    // Wait for show card to appear in Currently Watching
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "The White Lotus" })).toBeInTheDocument();
    });

    // Modal dialog is not open initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click the show card
    const card = screen.getByRole("heading", { level: 3, name: "The White Lotus" }).closest("article");
    expect(card).toBeInTheDocument();
    await user.click(card!);

    // ShowDetailModal opens
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { level: 2, name: "The White Lotus" })).toBeInTheDocument();
    expect(screen.getByText("9 / 10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Incredible soundtrack and performances.")).toBeInTheDocument();

    // Close the modal
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await db.delete();
  });
});

describe("Dashboard Tab Switching & Catalog Integration", () => {
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    const dbName = `test-page-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("switches tabs between Watching, Watchlist, Completed, and Dropped", async () => {
    const user = userEvent.setup();
    render(<Page store={store} />);

    // Initially on Watching
    const watchingTab = screen.getByRole("tab", { name: /watching/i });
    const watchlistTab = screen.getByRole("tab", { name: /watchlist/i });
    const completedTab = screen.getByRole("tab", { name: /completed/i });
    const droppedTab = screen.getByRole("tab", { name: /dropped/i });

    expect(watchingTab).toHaveAttribute("aria-selected", "true");
    expect(watchlistTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("region", { name: /currently watching/i })).toBeInTheDocument();

    // Click Watchlist
    await user.click(watchlistTab);
    expect(watchlistTab).toHaveAttribute("aria-selected", "true");
    expect(watchingTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("region", { name: /watchlist/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
    });

    // Click Completed
    await user.click(completedTab);
    expect(completedTab).toHaveAttribute("aria-selected", "true");
    expect(watchlistTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("region", { name: /completed/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/no completed titles/i)).toBeInTheDocument();
    });

    // Click Dropped
    await user.click(droppedTab);
    expect(droppedTab).toHaveAttribute("aria-selected", "true");
    expect(completedTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("region", { name: /dropped/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/no dropped titles/i)).toBeInTheDocument();
    });

    // Click back to Watching
    await user.click(watchingTab);
    expect(watchingTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: /currently watching/i })).toBeInTheDocument();
  });

  it("allows starting to watch a title from Watchlist, moving it to Watching reactively", async () => {
    const user = userEvent.setup();

    // Add a title to Plan to Watch
    await store.addTitle({
      name: "The White Lotus",
      type: "tv",
      status: "Plan to Watch",
      totalEpisodes: 6,
    });

    render(<Page store={store} />);

    // Switch to Watchlist tab
    const watchlistTab = screen.getByRole("tab", { name: /watchlist/i });
    await user.click(watchlistTab);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "The White Lotus" })).toBeInTheDocument();
    });

    // Click Start Watching
    const startWatchingBtn = screen.getByRole("button", { name: /start watching/i });
    await user.click(startWatchingBtn);

    // Watchlist should now be empty
    await waitFor(() => {
      expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
    });

    // Switch to Watching tab
    const watchingTab = screen.getByRole("tab", { name: /watching/i });
    await user.click(watchingTab);

    // The show should appear in Currently Watching
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "The White Lotus" })).toBeInTheDocument();
    });
  });

  it("allows deleting a title with confirmation from Watchlist tab", async () => {
    const user = userEvent.setup();

    await store.addTitle({
      name: "Silo",
      type: "tv",
      status: "Plan to Watch",
      totalEpisodes: 10,
    });

    render(<Page store={store} />);

    // Go to Watchlist
    const watchlistTab = screen.getByRole("tab", { name: /watchlist/i });
    await user.click(watchlistTab);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Silo" })).toBeInTheDocument();
    });

    // Click Delete
    const deleteBtn = screen.getByRole("button", { name: /delete silo/i });
    await user.click(deleteBtn);

    // Confirmation dialog
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    // Confirmed deleted
    await waitFor(() => {
      expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
    });

    const inDb = await store.getTitlesByStatus("Plan to Watch");
    expect(inDb).toHaveLength(0);
  });

  it("completes a show via '+1 Episode' on finale, showing celebration toast and moving it from Watching to Completed tab", async () => {
    const user = userEvent.setup();

    await store.addTitle(
      {
        name: "Ted Lasso",
        type: "tv",
        status: "Watching",
      },
      [
        {
          seasonNumber: 3,
          episodeNumber: 12,
          name: "So Long, Farewell",
          isWatched: false,
        },
      ]
    );

    render(<Page store={store} />);

    // In Watching tab, Ted Lasso appears
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Ted Lasso" })).toBeInTheDocument();
    });

    // Click +1 Episode (series finale)
    const incrementBtn = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(incrementBtn);

    // Toast appears
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("You finished Ted Lasso!");
    });

    // Show is no longer in Currently Watching
    expect(screen.queryByRole("heading", { level: 3, name: "Ted Lasso" })).not.toBeInTheDocument();
    expect(screen.getByText(/no shows currently being watched/i)).toBeInTheDocument();

    // Switch to Completed tab
    const completedTab = screen.getByRole("tab", { name: /completed/i });
    await user.click(completedTab);

    // Show is now visible in Completed tab
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Ted Lasso" })).toBeInTheDocument();
    });
  });
});
