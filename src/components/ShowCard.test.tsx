import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShowCard } from "./ShowCard";
import type { Title, EpisodeRecord, WatchStatus } from "../lib/types";

describe("ShowCard Component", () => {
  const mockTitle: Title = {
    id: "show-1",
    externalId: 101,
    type: "tv",
    name: "Severance",
    overview: "Office thriller",
    posterUrl: "https://static.tvmaze.com/uploads/images/medium_portrait/severance.jpg",
    backdropUrl: null,
    status: "Watching",
    rating: 9,
    notes: null,
    genres: ["Drama", "Sci-Fi"],
    firstAirDate: "2022-02-18",
    nextAirDate: null,
    totalEpisodes: 10,
    watchedEpisodes: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const mockNextEpisode: EpisodeRecord = {
    id: "ep-4",
    titleId: "show-1",
    seasonNumber: 1,
    episodeNumber: 4,
    name: "The You You Are",
    airDate: "2022-03-04",
    overview: "A strange book is discovered",
    isWatched: false,
    watchedAt: null,
  };

  it("renders show title, poster thumbnail, next episode badge, and progress bar", () => {
    render(<ShowCard title={mockTitle} nextEpisode={mockNextEpisode} />);

    // Title
    expect(screen.getByRole("heading", { level: 3, name: "Severance" })).toBeInTheDocument();

    // Poster image
    const poster = screen.getByRole("img", { name: "Severance" });
    expect(poster).toHaveAttribute("src", mockTitle.posterUrl);

    // Next episode badge (formatted as S01E04)
    expect(screen.getByText("S01E04")).toBeInTheDocument();

    // Progress bar (3 of 10 = 30%)
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "30");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("3 / 10 eps (30%)")).toBeInTheDocument();
  });

  it("renders fallback placeholder when posterUrl is null", () => {
    const titleWithoutPoster: Title = {
      ...mockTitle,
      posterUrl: null,
    };

    render(<ShowCard title={titleWithoutPoster} nextEpisode={mockNextEpisode} />);
    expect(screen.getByLabelText("No poster available")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("handles show with no next episode gracefully and displays Caught Up when all episodes watched", () => {
    const caughtUpTitle: Title = {
      ...mockTitle,
      totalEpisodes: 10,
      watchedEpisodes: 10,
    };
    render(<ShowCard title={caughtUpTitle} nextEpisode={null} />);
    expect(screen.queryByText(/^S\d\dE\d\d$/)).not.toBeInTheDocument();
    expect(screen.getByText("Caught Up")).toBeInTheDocument();
  });

  it("calls onSelect when the card is clicked", async () => {
    const onSelect = vi.fn();
    render(<ShowCard title={mockTitle} nextEpisode={mockNextEpisode} onSelect={onSelect} />);

    const card = screen.getByTestId(`show-card-${mockTitle.id}`);
    card.click();
    expect(onSelect).toHaveBeenCalledWith(mockTitle);
  });

  it("renders prominent '+1 Episode' button when next episode is available", () => {
    render(<ShowCard title={mockTitle} nextEpisode={mockNextEpisode} />);
    const button = screen.getByRole("button", { name: /\+1 Episode/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("renders quick increment button with accessible aria-label matching GLOSSARY standards", () => {
    render(<ShowCard title={mockTitle} nextEpisode={mockNextEpisode} />);
    const button = screen.getByRole("button", {
      name: `Quick Increment (+1 Episode) for ${mockTitle.name}`,
    });
    expect(button).toBeInTheDocument();
  });

  it("disables '+1 Episode' button when no next episode is available", () => {
    const caughtUpTitle: Title = {
      ...mockTitle,
      totalEpisodes: 10,
      watchedEpisodes: 10,
    };
    render(<ShowCard title={caughtUpTitle} nextEpisode={null} />);
    const button = screen.getByRole("button", { name: /\+1 Episode/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("calls onQuickIncrement when '+1 Episode' button is clicked and stops propagation", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onQuickIncrement = vi.fn();

    render(
      <ShowCard
        title={mockTitle}
        nextEpisode={mockNextEpisode}
        onSelect={onSelect}
        onQuickIncrement={onQuickIncrement}
      />
    );

    const button = screen.getByRole("button", { name: /\+1 Episode/i });
    await user.click(button);

    expect(onQuickIncrement).toHaveBeenCalledTimes(1);
    expect(onQuickIncrement).toHaveBeenCalledWith(mockTitle);
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("Upcoming Air Date Badge", () => {
    const fixedNow = new Date("2026-10-18T12:00:00Z");

    it("renders 'Next Ep: [Date]' badge when show has an upcoming air date in the future", () => {
      const upcomingTitle: Title = {
        ...mockTitle,
        nextAirDate: "2027-05-20",
        airingStatus: "Running",
      };

      render(
        <ShowCard
          title={upcomingTitle}
          nextEpisode={mockNextEpisode}
          referenceDate={fixedNow}
        />
      );

      const badge = screen.getByTestId("upcoming-air-date-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("Next Ep: May 20, 2027");
    });

    it("renders 'Next Ep: [Date]' badge alongside 'Caught Up' when all released episodes are watched", () => {
      const caughtUpWithUpcoming: Title = {
        ...mockTitle,
        totalEpisodes: 10,
        watchedEpisodes: 10,
        nextAirDate: "2026-11-01",
        airingStatus: "Running",
      };

      render(
        <ShowCard
          title={caughtUpWithUpcoming}
          nextEpisode={null}
          referenceDate={fixedNow}
        />
      );

      expect(screen.getByText("Caught Up")).toBeInTheDocument();
      const badge = screen.getByTestId("upcoming-air-date-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("Next Ep: Nov 1, 2026");
    });

    it("omits the upcoming badge when show has ended (airingStatus: 'Ended')", () => {
      const endedTitle: Title = {
        ...mockTitle,
        nextAirDate: "2027-05-20",
        airingStatus: "Ended",
      };

      render(
        <ShowCard
          title={endedTitle}
          nextEpisode={mockNextEpisode}
          referenceDate={fixedNow}
        />
      );

      expect(screen.queryByTestId("upcoming-air-date-badge")).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Ep:/i)).not.toBeInTheDocument();
    });

    it("omits the upcoming badge when title has ended via status: 'Ended'", () => {
      const endedTitle = {
        ...mockTitle,
        status: "Ended" as unknown as WatchStatus,
        nextAirDate: "2027-05-20",
      };

      render(
        <ShowCard
          title={endedTitle}
          nextEpisode={mockNextEpisode}
          referenceDate={fixedNow}
        />
      );

      expect(screen.queryByTestId("upcoming-air-date-badge")).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Ep:/i)).not.toBeInTheDocument();
    });

    it("omits the upcoming badge when nextAirDate is in the past", () => {
      const pastTitle: Title = {
        ...mockTitle,
        nextAirDate: "2026-01-15",
        airingStatus: "Running",
      };

      render(
        <ShowCard
          title={pastTitle}
          nextEpisode={mockNextEpisode}
          referenceDate={fixedNow}
        />
      );

      expect(screen.queryByTestId("upcoming-air-date-badge")).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Ep:/i)).not.toBeInTheDocument();
    });

    it("omits the upcoming badge when nextAirDate is null or undefined", () => {
      const noAirDateTitle: Title = {
        ...mockTitle,
        nextAirDate: null,
      };

      render(
        <ShowCard
          title={noAirDateTitle}
          nextEpisode={mockNextEpisode}
          referenceDate={fixedNow}
        />
      );

      expect(screen.queryByTestId("upcoming-air-date-badge")).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Ep:/i)).not.toBeInTheDocument();
    });
  });

  describe("Movie Titles on Active Dashboard", () => {
    const mockMovie: Title = {
      id: "movie-1",
      externalId: 999,
      type: "movie",
      name: "Inception",
      overview: "A thief who steals corporate secrets through the use of dream-sharing technology.",
      posterUrl: "https://example.com/inception.jpg",
      backdropUrl: null,
      status: "Watching",
      genres: ["Action", "Sci-Fi"],
      firstAirDate: "2010-07-16",
      nextAirDate: null,
      totalEpisodes: 1,
      watchedEpisodes: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    it("renders enabled 'Mark Watched' button for unwatched movie in Watching status", async () => {
      const onQuickIncrement = vi.fn();
      render(
        <ShowCard
          title={mockMovie}
          nextEpisode={null}
          onQuickIncrement={onQuickIncrement}
        />
      );

      const button = screen.getByRole("button", { name: /Mark Inception as watched/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
      expect(screen.getByText("Mark Watched")).toBeInTheDocument();

      await userEvent.click(button);
      expect(onQuickIncrement).toHaveBeenCalledWith(mockMovie);
    });

    it("renders disabled button when movie has already been watched", () => {
      const watchedMovie: Title = {
        ...mockMovie,
        watchedEpisodes: 1,
        status: "Completed",
      };

      render(
        <ShowCard
          title={watchedMovie}
          nextEpisode={null}
        />
      );

      const button = screen.getByRole("button", { name: /Mark Inception as watched/i });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Watched");
      expect(screen.getAllByText("Watched").length).toBeGreaterThanOrEqual(1);
    });
  });
});
