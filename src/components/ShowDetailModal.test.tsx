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

    const { rerender } = render(
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
});
