"use client";

import React from "react";
import { Tv, Plus } from "lucide-react";
import type { Title, EpisodeRecord } from "../lib/types";

export interface ShowCardProps {
  title: Title;
  nextEpisode?: EpisodeRecord | null;
  onSelect?: (title: Title) => void;
  onQuickIncrement?: (title: Title) => void;
}

export function formatEpisodeBadge(episode: EpisodeRecord | null | undefined): string | null {
  if (!episode) return null;
  const s = String(episode.seasonNumber).padStart(2, "0");
  const e = String(episode.episodeNumber).padStart(2, "0");
  return `S${s}E${e}`;
}

export function ShowCard({ title, nextEpisode, onSelect, onQuickIncrement }: ShowCardProps) {
  const total = title.totalEpisodes || 0;
  const watched = title.watchedEpisodes || 0;
  const percentage = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  const episodeBadge = formatEpisodeBadge(nextEpisode);
  const hasNextEpisode =
    nextEpisode !== undefined
      ? Boolean(nextEpisode)
      : total > 0 && watched < total;

  return (
    <article
      data-testid={`show-card-${title.id}`}
      onClick={() => onSelect?.(title)}
      className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition flex flex-col cursor-pointer"
    >
      <div className="flex gap-4 p-4">
        {/* Poster Thumbnail */}
        <div className="relative w-24 h-36 bg-slate-800 rounded-lg overflow-hidden shrink-0 border border-slate-800">
          {title.posterUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={title.posterUrl}
              alt={title.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div
              aria-label="No poster available"
              className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/80 p-2 text-center"
            >
              <Tv className="w-6 h-6 mb-1 opacity-40" />
              <span className="text-[10px] uppercase font-semibold tracking-wider">
                No Poster
              </span>
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-base font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                {title.name}
              </h3>
            </div>

            {/* Next Episode Badge or Caught Up */}
            {episodeBadge ? (
              <div className="mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-sm">
                  {episodeBadge}
                </span>
                {nextEpisode?.name && (
                  <span className="ml-2 text-xs text-slate-400 truncate inline-block align-middle max-w-[130px] sm:max-w-[180px]">
                    {nextEpisode.name}
                  </span>
                )}
              </div>
            ) : total > 0 && watched >= total ? (
              <div className="mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm">
                  Caught Up
                </span>
              </div>
            ) : null}
          </div>

          {/* Quick Increment Action & Progress */}
          <div className="space-y-2 mt-auto pt-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid={`quick-increment-${title.id}`}
                disabled={!hasNextEpisode}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasNextEpisode && onQuickIncrement) {
                    onQuickIncrement(title);
                  }
                }}
                aria-label={`+1 Episode for ${title.name}`}
                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  hasNextEpisode
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow cursor-pointer active:scale-95"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                }`}
              >
                <Plus className="w-3.5 h-3.5 mr-1 inline-block" />
                +1 Episode
              </button>
              <span className="text-xs text-slate-400 shrink-0">
                {watched} / {total} eps ({percentage}%)
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
