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

  describe("JSON backup import", () => {
    const validBackupData: backupModule.BackupData = {
      version: 1,
      exportedAt: "2026-10-18T10:00:00.000Z",
      titles: [
        {
          id: "import-t1",
          externalId: null,
          type: "tv",
          name: "Andor",
          overview: "Rebellion begins",
          posterUrl: null,
          backdropUrl: null,
          status: "Watching",
          rating: 9,
          notes: "Brilliant writing",
          genres: ["Sci-Fi", "Action"],
          firstAirDate: "2022-09-21",
          nextAirDate: null,
          totalEpisodes: 12,
          watchedEpisodes: 3,
          createdAt: "2026-10-18T10:00:00.000Z",
          updatedAt: "2026-10-18T10:00:00.000Z",
        },
      ],
      episodes: [
        {
          id: "import-e1",
          titleId: "import-t1",
          seasonNumber: 1,
          episodeNumber: 1,
          name: "Kassa",
          airDate: "2022-09-21",
          overview: "Cassian searches for his sister",
          isWatched: true,
          watchedAt: "2026-10-18T10:00:00.000Z",
        },
        {
          id: "import-e2",
          titleId: "import-t1",
          seasonNumber: 1,
          episodeNumber: 2,
          name: "That Would Be Me",
          airDate: "2022-09-21",
          overview: "Cassian lays low",
          isWatched: true,
          watchedAt: "2026-10-18T11:00:00.000Z",
        },
      ],
    };

    it("renders file upload input accepting .json files", async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);
      await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute("type", "file");
      expect(fileInput).toHaveAttribute("accept", expect.stringContaining(".json"));
    });

    it("displays an error alert when uploaded file contains malformed JSON", async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);
      await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

      const malformedFile = new File(["{invalid json"], "corrupt.json", {
        type: "application/json",
      });

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      await user.upload(fileInput, malformedFile);

      await waitFor(() => {
        const errorAlert = screen.getByRole("alert");
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(/malformed json|invalid json/i);
      });
    });

    it("displays an error alert when backup fails schema validation", async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);
      await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

      const invalidSchema = {
        version: 2,
        titles: "not-an-array",
      };
      const invalidFile = new File([JSON.stringify(invalidSchema)], "wrong-schema.json", {
        type: "application/json",
      });

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      await user.upload(fileInput, invalidFile);

      await waitFor(() => {
        const errorAlert = screen.getByRole("alert");
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(/version|invalid/i);
      });
    });

    it("displays confirmation dialog with warning before overwriting existing data", async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);
      await waitFor(() => expect(screen.getByText(/0 titles/i)).toBeInTheDocument());

      const file = new File([JSON.stringify(validBackupData)], "backup.json", {
        type: "application/json",
      });

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /confirm import/i })
        ).toBeInTheDocument();
        expect(screen.getByText(/overwrite/i)).toBeInTheDocument();
      });
    });

    it("cancels import when Cancel button is clicked on confirmation prompt", async () => {
      const user = userEvent.setup();
      await store.addTitle({
        name: "Existing Unmodified Show",
        type: "movie",
        status: "Completed",
      });

      render(<SettingsModal isOpen={true} onClose={vi.fn()} store={store} />);
      await waitFor(() => expect(screen.getByText(/1 title/i)).toBeInTheDocument());

      const file = new File([JSON.stringify(validBackupData)], "backup.json", {
        type: "application/json",
      });

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByText(/1 title/i)).toBeInTheDocument();
      });

      const dbTitles = await db.titles.toArray();
      expect(dbTitles).toHaveLength(1);
      expect(dbTitles[0].name).toBe("Existing Unmodified Show");
    });

    it("restores library, updates counts immediately, and shows success toast when Confirm is clicked", async () => {
      const user = userEvent.setup();
      const onImportSpy = vi.fn();

      await store.addTitle({
        name: "Old Show to Overwrite",
        type: "movie",
        status: "Plan to Watch",
      });

      render(
        <SettingsModal
          isOpen={true}
          onClose={vi.fn()}
          store={store}
          onImport={onImportSpy}
        />
      );

      await waitFor(() => expect(screen.getByText(/1 title/i)).toBeInTheDocument());

      const file = new File([JSON.stringify(validBackupData)], "backup.json", {
        type: "application/json",
      });

      const fileInput = screen.getByLabelText(/import backup \(json\)/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /confirm import/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/backup imported successfully/i)).toBeInTheDocument();
        // Immediately updated counts: 1 title, 2 episodes
        expect(screen.getByText(/1 title/i)).toBeInTheDocument();
        expect(screen.getByText(/2 episodes/i)).toBeInTheDocument();
      });

      expect(onImportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          titles: expect.arrayContaining([
            expect.objectContaining({ name: "Andor" }),
          ]),
        })
      );

      const dbTitles = await db.titles.toArray();
      expect(dbTitles).toHaveLength(1);
      expect(dbTitles[0].name).toBe("Andor");

      const dbEpisodes = await db.episodes.toArray();
      expect(dbEpisodes).toHaveLength(2);
    });
  });
});

