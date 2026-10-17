import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsModal } from "./SettingsModal";
import { TrackerStore, ShowTrackerDB } from "../lib/store";
import * as backupModule from "../lib/backup";

describe("SettingsModal", () => {
  let dbName: string;
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    dbName = `test-settings-db-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<SettingsModal isOpen={false} onClose={vi.fn()} store={store} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal with Data Management section and export button when open", async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /data management/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export backup \(json\)/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/0 titles/i)).toBeInTheDocument();
      expect(screen.getByText(/0 episodes/i)).toBeInTheDocument();
    });
  });

  it("displays singular title and plural episodes correctly", async () => {
    await store.addTitle(
      {
        type: "tv",
        name: "Severance",
        status: "Watching",
      },
      [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Good News About Hell",
        },
        {
          seasonNumber: 1,
          episodeNumber: 2,
          name: "Half Loop",
        },
      ]
    );

    render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);

    await waitFor(() => {
      expect(screen.getByText(/1 title/i)).toBeInTheDocument();
      expect(screen.getByText(/2 episodes/i)).toBeInTheDocument();
    });
  });

  it("displays plural titles and singular episode correctly", async () => {
    await store.addTitle(
      {
        type: "tv",
        name: "Show One",
        status: "Watching",
      },
      [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Episode 1",
        },
      ]
    );

    await store.addTitle({
      type: "movie",
      name: "Movie Two",
      status: "Plan to Watch",
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);

    await waitFor(() => {
      expect(screen.getByText(/2 titles/i)).toBeInTheDocument();
      expect(screen.getByText(/1 episode/i)).toBeInTheDocument();
    });
  });

  it("triggers backup export and download when clicking Export Backup (JSON)", async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(backupModule, "downloadBackupJson").mockImplementation(() => {});

    await store.addTitle({
      type: "movie",
      name: "The Matrix",
      status: "Completed",
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);

    await waitFor(() => {
      expect(screen.getByText(/1 title/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByRole("button", { name: /export backup \(json\)/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });

    const exportedBackup = downloadSpy.mock.calls[0][0];
    expect(exportedBackup.version).toBe(1);
    expect(exportedBackup.titles).toHaveLength(1);
    expect(exportedBackup.titles[0].name).toBe("The Matrix");
    expect(screen.getByText(/backup exported successfully/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} store={store} />);
    await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside on the backdrop", async () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} store={store} />);
    await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal content", async () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} store={store} />);
    await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

    const heading = screen.getByRole("heading", { name: /settings/i });
    fireEvent.click(heading);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", async () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} store={store} />);
    await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
