import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";

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

