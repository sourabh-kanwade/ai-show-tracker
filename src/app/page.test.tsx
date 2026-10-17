import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("Show Tracker App Shell (Smoke Test)", () => {
  it("renders the application header and branding", () => {
    render(<Page />);
    const heading = screen.getByRole("heading", { level: 1, name: /show tracker/i });
    expect(heading).toBeInTheDocument();
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
