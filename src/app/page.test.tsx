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

  it("renders a container for tracked titles", () => {
    render(<Page />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
  });
});
