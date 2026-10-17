import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";
import { TrackerStore, ShowTrackerDB } from "../lib/store";

describe("SearchBar Component", () => {
  let dbName: string;
  let db: ShowTrackerDB;
  let store: TrackerStore;

  beforeEach(() => {
    dbName = `test-search-bar-${Math.random().toString(36).substring(2, 9)}`;
    db = new ShowTrackerDB(dbName);
    store = new TrackerStore(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("renders a search input with search icon and placeholder", () => {
    render(<SearchBar store={store} />);
    const input = screen.getByRole("searchbox", { name: /search shows/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search TV shows...");
  });

  it("opens the search modal when the search bar input is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchBar store={store} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const input = screen.getByRole("searchbox", { name: /search shows/i });
    await user.click(input);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens search modal when pressing Cmd+K / Ctrl+K keyboard shortcut", () => {
    render(<SearchBar store={store} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the search modal when close is triggered", async () => {
    const user = userEvent.setup();
    render(<SearchBar store={store} />);

    const input = screen.getByRole("searchbox", { name: /search shows/i });
    await user.click(input);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
