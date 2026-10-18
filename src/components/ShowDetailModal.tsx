"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  X,
  Tv,
  Star,
  Calendar,
  Bookmark,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Trash2,
} from "lucide-react";
import type { Title, WatchStatus, EpisodeRecord, TitleWithEpisodes } from "../lib/types";
import { TrackerStore, trackerStore as defaultStore, findNextEpisode } from "../lib/store";
import { formatEpisodeBadge } from "./ShowCard";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

export interface ShowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: Title | TitleWithEpisodes | null;
  titleId?: string | null;
  store?: TrackerStore;
  debounceMs?: number;
  onStatusChange?: (status: WatchStatus) => void;
  onRatingChange?: (rating: number | null) => void;
  onNotesChange?: (notes: string) => void;
  onTitleDeleted?: (titleId: string) => void;
}

const WATCH_STATUSES: { value: WatchStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "Plan to Watch", label: "Plan to Watch", icon: Bookmark },
  { value: "Watching", label: "Watching", icon: Tv },
  { value: "Completed", label: "Completed", icon: CheckCircle2 },
  { value: "Dropped", label: "Dropped", icon: XCircle },
];

export function ShowDetailModal({
  isOpen,
  onClose,
  title = null,
  titleId = null,
  store = defaultStore,
  debounceMs = 400,
  onStatusChange,
  onRatingChange,
  onNotesChange,
  onTitleDeleted,
}: ShowDetailModalProps) {
  const effectiveTitleId = titleId ?? title?.id ?? null;

  // Live query to keep title data reactive with IndexedDB updates
  const liveTitle = useLiveQuery(
    async () => {
      if (!isOpen || !effectiveTitleId) return null;
      return (await store.db.titles.get(effectiveTitleId)) ?? null;
    },
    [isOpen, effectiveTitleId, store]
  );

  // Live query to keep episodes reactive with IndexedDB updates
  const liveEpisodes = useLiveQuery(
    async () => {
      if (!isOpen || !effectiveTitleId) return [];
      return await store.getEpisodes(effectiveTitleId);
    },
    [isOpen, effectiveTitleId, store]
  );

  const currentTitle = liveTitle ?? title ?? null;
  const episodes: EpisodeRecord[] =
    liveEpisodes ??
    (title && "episodes" in title ? ((title as TitleWithEpisodes).episodes ?? []) : []);

  // Selected season state
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  // Delete modal state
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local state for notes & autosave
  const [notes, setNotes] = useState(currentTitle?.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeTitleIdRef = useRef<string | null>(null);
  const notesRef = useRef(notes);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Sync notes & reset season when currentTitle id changes (e.g. opened for different title)
  useEffect(() => {
    if (currentTitle) {
      if (activeTitleIdRef.current !== currentTitle.id) {
        activeTitleIdRef.current = currentTitle.id;
        setNotes(currentTitle.notes ?? "");
        setSaveStatus("idle");
        setSelectedSeason(null);
        if (notesTimerRef.current) {
          clearTimeout(notesTimerRef.current);
          notesTimerRef.current = null;
        }
      }
    }
  }, [currentTitle]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
      }
    };
  }, []);

  // Escape key handler
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

  const handleStatusChange = async (newStatus: WatchStatus) => {
    if (!currentTitle) return;
    try {
      await store.updateTitleStatus(currentTitle.id, newStatus);
      onStatusChange?.(newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleRatingChange = async (newRating: number | null) => {
    if (!currentTitle) return;
    try {
      await store.updateTitleRatingAndNotes(currentTitle.id, newRating);
      onRatingChange?.(newRating);
    } catch (err) {
      console.error("Failed to update rating:", err);
    }
  };

  const persistNotes = useCallback(
    async (text: string) => {
      if (!currentTitle) return;
      try {
        await store.updateTitleRatingAndNotes(currentTitle.id, undefined, text);
        setSaveStatus("saved");
        onNotesChange?.(text);
      } catch (err) {
        console.error("Failed to persist notes:", err);
        setSaveStatus("idle");
      }
    },
    [currentTitle, store, onNotesChange]
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setNotes(nextVal);
    setSaveStatus("saving");

    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    notesTimerRef.current = setTimeout(() => {
      persistNotes(nextVal);
      notesTimerRef.current = null;
    }, debounceMs);
  };

  const handleNotesBlur = () => {
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
      persistNotes(notesRef.current);
    }
  };

  const handleToggleEpisode = async (episodeId: string, isWatched: boolean) => {
    try {
      await store.toggleEpisodeWatched(episodeId, isWatched);
    } catch (err) {
      console.error("Failed to toggle episode:", err);
    }
  };

  const handleMarkSeasonWatched = async (seasonNum: number, isWatched: boolean) => {
    if (!currentTitle) return;
    try {
      await store.markSeasonWatched(currentTitle.id, seasonNum, isWatched);
    } catch (err) {
      console.error("Failed to mark season watched:", err);
    }
  };

  const handleDeleteTitle = async () => {
    if (!currentTitle) return;
    setIsDeleting(true);
    try {
      await store.deleteTitle(currentTitle.id);
      setIsConfirmDeleteOpen(false);
      onTitleDeleted?.(currentTitle.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete title:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !currentTitle) {
    return null;
  }

  const currentRating = currentTitle.rating ?? null;
  const currentStatus = currentTitle.status;

  const seasons = Array.from(new Set(episodes.map((e) => e.seasonNumber))).sort((a, b) => a - b);
  const activeSeason =
    selectedSeason !== null && seasons.includes(selectedSeason)
      ? selectedSeason
      : (seasons[0] ?? 1);

  const activeSeasonEpisodes = episodes.filter((e) => e.seasonNumber === activeSeason);
  const seasonWatchedCount = activeSeasonEpisodes.filter((e) => e.isWatched).length;
  const seasonTotalCount = activeSeasonEpisodes.length;
  const isSeasonAllWatched = seasonTotalCount > 0 && seasonWatchedCount === seasonTotalCount;

  const effectiveTotalCount =
    episodes.length > 0
      ? episodes.length
      : (currentTitle?.totalEpisodes || 0);

  const effectiveWatchedCount =
    episodes.length > 0
      ? episodes.filter((e) => e.isWatched).length
      : (currentTitle?.watchedEpisodes || 0);

  const progressPercentage =
    effectiveTotalCount > 0
      ? Math.min(100, Math.round((effectiveWatchedCount / effectiveTotalCount) * 100))
      : 0;

  const nextEpisode = findNextEpisode(episodes);
  const nextEpisodeBadge = formatEpisodeBadge(nextEpisode);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="show-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      {/* Backdrop overlay */}
      <div
        data-testid="modal-backdrop-overlay"
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop Banner / Header Artwork */}
        <div
          data-testid="show-backdrop"
          className="relative w-full h-44 sm:h-52 bg-slate-800 overflow-hidden shrink-0 border-b border-slate-800"
        >
          {currentTitle.backdropUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={currentTitle.backdropUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-950/90 transition-colors z-20 backdrop-blur-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 -mt-16 sm:-mt-20 relative z-10 space-y-6 overflow-y-auto">
          {/* Header Row: Poster + Title Info */}
          <div className="flex gap-4 sm:gap-6 items-end sm:items-start">
            {/* Poster Thumbnail */}
            <div className="relative w-24 h-36 sm:w-32 sm:h-48 bg-slate-800 rounded-xl overflow-hidden shrink-0 border-2 border-slate-700 shadow-xl">
              {currentTitle.posterUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentTitle.posterUrl}
                  alt={currentTitle.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  aria-label="No poster available"
                  className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/80 p-2 text-center"
                >
                  <Tv className="w-8 h-8 mb-1 opacity-40" />
                  <span className="text-[10px] uppercase font-semibold tracking-wider">
                    No Poster
                  </span>
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-16">
              <h2
                id="show-detail-modal-title"
                className="text-xl sm:text-2xl font-bold text-white leading-tight truncate"
              >
                {currentTitle.name}
              </h2>

              {/* Premier Date */}
              {currentTitle.firstAirDate && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 mt-1">
                  <Calendar className="w-3.5 h-3.5 opacity-70" />
                  <span>Premiered: {currentTitle.firstAirDate}</span>
                </div>
              )}

              {/* Genres */}
              {currentTitle.genres && currentTitle.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {currentTitle.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overall Show Progress Bar & Next Episode Tag */}
          {effectiveTotalCount > 0 && (
            <section
              aria-label="Episode Progress"
              className="p-3.5 sm:p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Progress
                  </span>
                  {nextEpisodeBadge ? (
                    <span
                      data-testid="next-episode-tag"
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-sm"
                    >
                      Next: {nextEpisodeBadge}
                      {nextEpisode?.name ? ` - ${nextEpisode.name}` : ""}
                    </span>
                  ) : effectiveWatchedCount >= effectiveTotalCount && effectiveTotalCount > 0 ? (
                    <span
                      data-testid="next-episode-tag"
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm"
                    >
                      Caught Up
                    </span>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-slate-300">
                  {effectiveWatchedCount} / {effectiveTotalCount} eps ({progressPercentage}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </section>
          )}

          {/* Synopsis Section */}
          <section aria-label="Synopsis" className="space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Synopsis
            </h3>
            <p className="text-sm text-slate-300/90 leading-relaxed">
              {currentTitle.overview ? currentTitle.overview : "No synopsis available."}
            </p>
          </section>

          {/* Watch Status Selector */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="watch-status-select"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                Watch Status
              </label>
            </div>

            {/* Select Dropdown */}
            <div className="relative">
              <select
                id="watch-status-select"
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value as WatchStatus)}
                className="w-full sm:w-auto min-w-[200px] px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {WATCH_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Status Buttons */}
            <div
              role="group"
              aria-label="Status quick buttons"
              className="flex flex-wrap gap-2 pt-1"
            >
              {WATCH_STATUSES.map(({ value, label, icon: Icon }) => {
                const isActive = currentStatus === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleStatusChange(value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Interactive Season & Episode Checklist */}
          {episodes.length > 0 && (
            <section aria-label="Season & Episode Checklist" className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Seasons & Episodes
                </h3>
                <button
                  type="button"
                  data-testid="mark-season-watched-btn"
                  onClick={() => handleMarkSeasonWatched(activeSeason, !isSeasonAllWatched)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSeasonAllWatched
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isSeasonAllWatched ? "Mark Season as Unwatched" : "Mark Season as Watched"}
                  </span>
                </button>
              </div>

              {/* Season Selector Tabs */}
              <div
                role="tablist"
                aria-label="Season selector tabs"
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin"
              >
                {seasons.map((s) => {
                  const sEps = episodes.filter((e) => e.seasonNumber === s);
                  const sWatched = sEps.filter((e) => e.isWatched).length;
                  const sTotal = sEps.length;
                  const isSelected = activeSeason === s;

                  return (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedSeason(s)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
                      }`}
                    >
                      Season {s} ({sWatched}/{sTotal})
                    </button>
                  );
                })}
              </div>

              {/* Episode Checklist */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl divide-y divide-slate-800/60 overflow-hidden">
                {activeSeasonEpisodes.map((ep) => (
                  <label
                    key={ep.id}
                    htmlFor={`episode-checkbox-${ep.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-slate-800/40 transition cursor-pointer select-none"
                  >
                    <input
                      id={`episode-checkbox-${ep.id}`}
                      type="checkbox"
                      data-testid={`episode-checkbox-${ep.id}`}
                      aria-label={`Episode ${ep.episodeNumber}: ${ep.name}`}
                      checked={ep.isWatched}
                      onChange={(e) => handleToggleEpisode(ep.id, e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-xs font-mono font-medium text-slate-400 shrink-0">
                          Episode {ep.episodeNumber}
                        </span>
                        <span
                          className={`text-sm truncate ${
                            ep.isWatched ? "text-slate-400 line-through" : "text-slate-200"
                          }`}
                        >
                          {ep.name}
                        </span>
                      </div>
                      {ep.airDate && (
                        <span className="text-xs text-slate-400 shrink-0">
                          {ep.airDate}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* 1–10 Rating Component */}
          <section aria-labelledby="rating-section-title" className="space-y-2">
            <div className="flex items-center justify-between">
              <h3
                id="rating-section-title"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                Rating
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-300">
                  {currentRating !== null ? `${currentRating} / 10` : "Not rated"}
                </span>
                {currentRating !== null && (
                  <button
                    type="button"
                    onClick={() => handleRatingChange(null)}
                    aria-label="Clear rating"
                    className="text-xs text-slate-400 hover:text-rose-400 transition underline cursor-pointer"
                  >
                    Clear rating
                  </button>
                )}
              </div>
            </div>

            {/* 10 Star Rating Buttons */}
            <div
              role="group"
              aria-label="Rating selector"
              className="flex items-center gap-1 flex-wrap p-2 bg-slate-950/60 border border-slate-800 rounded-lg"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
                const isSelected = currentRating !== null && score <= currentRating;
                const isHovered = hoverRating !== null && score <= hoverRating;
                const isLit = isHovered || (hoverRating === null && isSelected);

                return (
                  <button
                    key={score}
                    type="button"
                    aria-label={`Rate ${score} out of 10`}
                    data-testid={`rating-${score}`}
                    onClick={() =>
                      handleRatingChange(currentRating === score ? null : score)
                    }
                    onMouseEnter={() => setHoverRating(score)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 rounded hover:bg-slate-800 transition flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        isLit
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-slate-500"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold ${
                        isLit ? "text-amber-300" : "text-slate-500"
                      }`}
                    >
                      {score}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Personal Notes Textarea */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="personal-notes"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                Personal Notes
              </label>

              {/* Autosave Status Indicator */}
              <div className="flex items-center gap-1 text-xs text-slate-400" aria-live="polite">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-indigo-400">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
            </div>

            <textarea
              id="personal-notes"
              aria-label="Personal notes"
              value={notes}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              placeholder="Add your thoughts or private notes here..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-y leading-relaxed"
            />
          </section>

          {/* Danger Zone / Delete Title */}
          <section className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Manage this title in your library
            </span>
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              aria-label="Delete Title"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Title</span>
            </button>
          </section>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        titleName={currentTitle.name}
        onConfirm={handleDeleteTitle}
        onCancel={() => setIsConfirmDeleteOpen(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
