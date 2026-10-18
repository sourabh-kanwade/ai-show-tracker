"use client";

import React from "react";
import { Tv, Star, Trash2, Play, RotateCcw } from "lucide-react";
import type { Title, WatchStatus } from "../lib/types";

export interface TitleCatalogCardProps {
  title: Title;
  status: WatchStatus;
  onSelect?: (title: Title) => void;
  onStartWatching?: (title: Title) => void | Promise<void>;
  onResume?: (title: Title) => void | Promise<void>;
  onRewatch?: (title: Title) => void | Promise<void>;
  onRequestDelete?: (title: Title) => void;
}

export function TitleCatalogCard({
  title,
  status,
  onSelect,
  onStartWatching,
  onResume,
  onRewatch,
  onRequestDelete,
}: TitleCatalogCardProps) {
  const total = title.totalEpisodes || 0;
  const watched = title.watchedEpisodes || 0;
  const percentage = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;

  const premierYear = title.firstAirDate ? title.firstAirDate.slice(0, 4) : null;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <article
      data-testid={`catalog-card-${title.id}`}
      onClick={() => onSelect?.(title)}
      className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition flex flex-col cursor-pointer"
    >
      <div className="flex gap-4 p-4 flex-1">
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

              {/* Status Specific Badges (Rating, etc) */}
              {status === "Completed" && (
                <div className="shrink-0">
                  {title.rating !== null && title.rating !== undefined ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {title.rating}/10
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      Unrated
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Metadata (Year, Type, Episodes) */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
              {premierYear && <span>{premierYear}</span>}
              {premierYear && (title.type || total > 0) && <span>•</span>}
              {title.type === "movie" ? (
                <span>Movie</span>
              ) : total > 0 ? (
                <span>{total} episode{total === 1 ? "" : "s"}</span>
              ) : null}
            </div>

            {/* Genres */}
            {title.genres && title.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {title.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700/50"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Status-specific middle content */}
            {status === "Completed" && (
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                  Completed
                </span>
                {title.updatedAt && (
                  <span>{formatDate(title.updatedAt)}</span>
                )}
              </div>
            )}

            {status === "Dropped" && (
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {watched} / {total} eps ({percentage}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )}

            {status === "Plan to Watch" && title.overview && (
              <p className="text-xs text-slate-400/90 line-clamp-2 mt-1 leading-relaxed">
                {title.overview}
              </p>
            )}
          </div>

          {/* Actions Row */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              {status === "Plan to Watch" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartWatching?.(title);
                  }}
                  aria-label={`Start watching ${title.name}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Watching</span>
                </button>
              )}

              {status === "Completed" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRewatch?.(title);
                  }}
                  aria-label={`Rewatch ${title.name}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rewatch</span>
                </button>
              )}

              {status === "Dropped" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume?.(title);
                  }}
                  aria-label={`Resume watching ${title.name}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </button>
              )}
            </div>

            {/* Delete / Remove Action */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete?.(title);
              }}
              aria-label={`Delete ${title.name}`}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
