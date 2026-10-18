"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  Tv,
  Bookmark,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  Film,
} from "lucide-react";
import type { Title, WatchStatus } from "../lib/types";
import {
  searchShows,
  getShowWithEpisodes,
  toCreateTitleInput,
  toCreateEpisodeInput,
  type TVMazeSearchResult,
} from "../lib/tvmaze";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  store?: TrackerStore;
  customFetch?: typeof fetch;
  onShowAdded?: (title: Title, action: "watchlist" | "watching") => void;
  onTitleAdded?: (title: Title, action: "watchlist" | "watching") => void;
}

export function SearchModal({
  isOpen,
  onClose,
  initialQuery = "",
  store = defaultStore,
  customFetch = fetch,
  onShowAdded,
  onTitleAdded,
}: SearchModalProps) {
  const notifyTitleAdded = (title: Title, action: "watchlist" | "watching") => {
    onTitleAdded?.(title, action);
    onShowAdded?.(title, action);
  };

  const [query, setQuery] = useState(initialQuery);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  const [results, setResults] = useState<TVMazeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryMap, setLibraryMap] = useState<Map<string, WatchStatus>>(new Map());
  const [loadingAction, setLoadingAction] = useState<
    Record<number, "watchlist" | "watching">
  >({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [isAddingMovie, setIsAddingMovie] = useState(false);
  const [movieName, setMovieName] = useState("");
  const [movieYear, setMovieYear] = useState("");
  const [movieGenres, setMovieGenres] = useState("");
  const [movieOverview, setMovieOverview] = useState("");
  const [isSavingMovie, setIsSavingMovie] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state during render when props change
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
      }
    } else {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setError(null);
      setIsAddingMovie(false);
      setMovieName("");
      setMovieYear("");
      setMovieGenres("");
      setMovieOverview("");
    }
  } else if (isOpen && initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  // Load existing titles from store to prevent duplicate imports
  useEffect(() => {
    let active = true;
    if (isOpen) {
      store
        .getTitlesByStatus()
        .then((titles) => {
          if (!active) return;
          const map = new Map<string, WatchStatus>();
          for (const t of titles) {
            if (t.externalId !== null && t.externalId !== undefined) {
              map.set(String(t.externalId), t.status);
            }
          }
          setLibraryMap(map);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [isOpen, store]);

  // Handle keyboard shortcuts (Escape to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search effect (300ms)
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await searchShows(trimmed, customFetch);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to search TVMaze");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen, customFetch]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      setIsLoading(false);
      setError(null);
    }
  };

  const handleClearQuery = () => {
    setQuery("");
    setResults([]);
    setIsLoading(false);
    setError(null);
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleAddToWatchlist = async (show: TVMazeSearchResult) => {
    setLoadingAction((prev) => ({ ...prev, [show.id]: "watchlist" }));
    try {
      const details = await getShowWithEpisodes(show.id, customFetch);
      const titleInput = toCreateTitleInput(details, "Plan to Watch");
      const episodesInput = details.episodes.map((ep) =>
        toCreateEpisodeInput(ep)
      );
      const created = await store.addTitle(titleInput, episodesInput);
      setLibraryMap((prev) => new Map(prev).set(String(show.id), "Plan to Watch"));
      setToast({
        message: `Added "${show.name}" to Watchlist`,
        type: "success",
      });
      notifyTitleAdded(created, "watchlist");
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to add "${show.name}" to watchlist`,
        type: "error",
      });
    } finally {
      setLoadingAction((prev) => {
        const copy = { ...prev };
        delete copy[show.id];
        return copy;
      });
    }
  };

  const handleStartWatching = async (show: TVMazeSearchResult) => {
    setLoadingAction((prev) => ({ ...prev, [show.id]: "watching" }));
    try {
      const details = await getShowWithEpisodes(show.id, customFetch);
      const titleInput = toCreateTitleInput(details, "Watching");
      const episodesInput = details.episodes.map((ep) =>
        toCreateEpisodeInput(ep)
      );
      const created = await store.addTitle(titleInput, episodesInput);
      setLibraryMap((prev) => new Map(prev).set(String(show.id), "Watching"));
      const epCount = details.episodes.length;
      setToast({
        message: `Started watching "${show.name}" (${epCount} episode${
          epCount === 1 ? "" : "s"
        })`,
        type: "success",
      });
      notifyTitleAdded(created, "watching");
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to start watching "${show.name}"`,
        type: "error",
      });
    } finally {
      setLoadingAction((prev) => {
        const copy = { ...prev };
        delete copy[show.id];
        return copy;
      });
    }
  };

  const handleSaveMovie = async (status: "Plan to Watch" | "Completed") => {
    const trimmed = movieName.trim();
    if (!trimmed) {
      setToast({
        message: "Movie title is required",
        type: "error",
      });
      return;
    }

    setIsSavingMovie(true);
    try {
      const year = movieYear.trim();
      const genresList = movieGenres
        ? movieGenres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];

      const created = await store.addTitle({
        name: trimmed,
        type: "movie",
        status,
        overview: movieOverview.trim(),
        genres: genresList,
        firstAirDate: year ? `${year}-01-01` : null,
        totalEpisodes: 1,
        watchedEpisodes: status === "Completed" ? 1 : 0,
      });

      setToast({
        message: `Added movie "${created.name}" to library`,
        type: "success",
      });

      notifyTitleAdded(created, status === "Completed" ? "watching" : "watchlist");
      setIsAddingMovie(false);
      setMovieName("");
      setMovieYear("");
      setMovieGenres("");
      setMovieOverview("");
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to add movie",
        type: "error",
      });
    } finally {
      setIsSavingMovie(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const trimmedQuery = query.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search TV shows"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-10"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/90">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search TV shows..."
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-400 focus:outline-none focus:ring-0 text-base"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search query"
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isAddingMovie && query.trim()) {
                setMovieName(query.trim());
              }
              setIsAddingMovie((prev) => !prev);
            }}
            aria-label="Add Movie Manually"
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer shrink-0"
          >
            {isAddingMovie ? "Search Shows" : "Add Movie"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isAddingMovie ? (
            <div className="space-y-4" data-testid="add-movie-form">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">Add Movie Manually</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingMovie(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition underline cursor-pointer"
                >
                  Back to search
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="movie-title-input"
                    className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                  >
                    Movie Title *
                  </label>
                  <input
                    id="movie-title-input"
                    type="text"
                    value={movieName}
                    onChange={(e) => setMovieName(e.target.value)}
                    placeholder="e.g. Inception"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="movie-year-input"
                      className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                    >
                      Release Year
                    </label>
                    <input
                      id="movie-year-input"
                      type="text"
                      value={movieYear}
                      onChange={(e) => setMovieYear(e.target.value)}
                      placeholder="e.g. 2010"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="movie-genres-input"
                      className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                    >
                      Genres
                    </label>
                    <input
                      id="movie-genres-input"
                      type="text"
                      value={movieGenres}
                      onChange={(e) => setMovieGenres(e.target.value)}
                      placeholder="e.g. Sci-Fi, Action"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="movie-overview-input"
                    className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                  >
                    Synopsis
                  </label>
                  <textarea
                    id="movie-overview-input"
                    rows={3}
                    value={movieOverview}
                    onChange={(e) => setMovieOverview(e.target.value)}
                    placeholder="Brief description or synopsis..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingMovie(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMovie("Plan to Watch")}
                  disabled={isSavingMovie || !movieName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add to Watchlist</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMovie("Completed")}
                  disabled={isSavingMovie || !movieName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Watched</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Searching TV shows...</p>
                </div>
              )}

              {error && !isLoading && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-sm">
                  <p className="font-medium">Error searching TV shows</p>
                  <p className="text-xs text-rose-400 mt-1">{error}</p>
                </div>
              )}

              {!isLoading && !error && trimmedQuery === "" && (
                <div className="text-center py-16 text-slate-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Search for TV shows</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Type a title above to search TVMaze and add to your library.
                  </p>
                </div>
              )}

              {!isLoading && !error && trimmedQuery !== "" && results.length === 0 && (
                <div className="text-center py-14 text-slate-400">
                  <Tv className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                  <p className="text-sm font-medium">
                    No shows found for &quot;{trimmedQuery}&quot;
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Looking for a movie or an unlisted title? Add it manually.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMovieName(trimmedQuery);
                      setIsAddingMovie(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
                  >
                    <span>Add &quot;{trimmedQuery}&quot; as Movie</span>
                  </button>
                </div>
              )}

          {!isLoading && results.length > 0 && (
            <div className="divide-y divide-slate-800/80 space-y-4">
              {results.map((show) => {
                const statusInLibrary = libraryMap.get(String(show.id));
                const isActionLoading = Boolean(loadingAction[show.id]);
                const premierYear = show.premiered
                  ? show.premiered.slice(0, 4)
                  : null;

                return (
                  <article
                    key={show.id}
                    className="pt-4 first:pt-0 flex flex-col sm:flex-row gap-4 items-start"
                  >
                    {/* Show Poster Thumbnail or Fallback */}
                    {show.posterUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={show.posterUrl}
                        alt={show.name}
                        className="w-20 h-28 object-cover rounded-md bg-slate-800 shrink-0 border border-slate-800"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        aria-label="No poster available"
                        className="w-20 h-28 bg-slate-800/90 rounded-md border border-slate-700/60 flex flex-col items-center justify-center text-slate-500 shrink-0"
                      >
                        <Tv className="w-6 h-6 mb-1 opacity-40" />
                        <span className="text-[10px] uppercase font-semibold tracking-wider">
                          No Poster
                        </span>
                      </div>
                    )}

                    {/* Show Details */}
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white leading-snug">
                          {show.name}
                        </h3>

                        {/* Rating Badge */}
                        {show.rating !== null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {show.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Metadata Row: Year & Network */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
                        {premierYear && <span>{premierYear}</span>}
                        {premierYear && show.networkOrWebChannel && (
                          <span>•</span>
                        )}
                        {show.networkOrWebChannel && (
                          <span>{show.networkOrWebChannel}</span>
                        )}
                      </div>

                      {/* Genres */}
                      {show.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {show.genres.map((genre) => (
                            <span
                              key={genre}
                              className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700/50"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Synopsis/Summary */}
                      {show.summary ? (
                        <p className="text-xs text-slate-300/90 line-clamp-3 mb-3 leading-relaxed">
                          {show.summary}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic mb-3">
                          No summary available.
                        </p>
                      )}

                      {/* Action Buttons or Existing Library Status Indicator */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {statusInLibrary ? (
                          <div className="flex items-center gap-2">
                            {statusInLibrary === "Plan to Watch" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-sm">
                                <Bookmark className="w-3.5 h-3.5" />
                                In Watchlist
                              </span>
                            )}
                            {statusInLibrary === "Watching" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm">
                                <Tv className="w-3.5 h-3.5" />
                                Watching
                              </span>
                            )}
                            {statusInLibrary === "Completed" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-700/60 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Completed
                              </span>
                            )}
                            {statusInLibrary === "Dropped" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 shadow-sm">
                                <XCircle className="w-3.5 h-3.5" />
                                Dropped
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAddToWatchlist(show)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                            >
                              {loadingAction[show.id] === "watchlist" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              ) : (
                                <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                              <span>Add to Watchlist</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartWatching(show)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition disabled:opacity-50"
                            >
                              {loadingAction[show.id] === "watching" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Tv className="w-3.5 h-3.5" />
                              )}
                              <span>Start Watching</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  </div>

      {/* Toast Notification for Visual Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border ${
            toast.type === "success"
              ? "bg-slate-900 border-emerald-500/60 text-emerald-200"
              : "bg-slate-900 border-rose-500/60 text-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
