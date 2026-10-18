"use client";

import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Tv, CheckCircle2 } from "lucide-react";
import { ShowCard } from "./ShowCard";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";
import type { Title } from "../lib/types";

export interface CurrentlyWatchingGridProps {
  store?: TrackerStore;
  onSelectTitle?: (title: Title) => void;
  onQuickIncrement?: (title: Title) => void;
}

export function CurrentlyWatchingGrid({
  store = defaultStore,
  onSelectTitle,
  onQuickIncrement,
}: CurrentlyWatchingGridProps) {
  const [toast, setToast] = useState<{
    message: string;
    type: "success";
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeShows = useLiveQuery(() => store.getActiveWatchingShows(), [store]);

  const handleQuickIncrement = async (title: Title) => {
    try {
      const result = await store.quickIncrement(title.id);
      if (result?.isCompleted) {
        setToast({
          message: `You finished ${title.name}!`,
          type: "success",
        });
      }
      onQuickIncrement?.(result?.title ?? title);
    } catch (err) {
      console.error("Failed to quick increment episode:", err);
    }
  };

  return (
    <>
      {activeShows === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-full py-12 text-center text-slate-500">
            <p className="text-sm">Loading active shows...</p>
          </div>
        </div>
      ) : activeShows.length === 0 ? (
        <div className="col-span-full text-center py-16 text-slate-500">
          <Tv className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
          <p className="text-base font-medium text-slate-300">
            No shows currently being watched
          </p>
          <p className="text-sm mt-1 text-slate-500">
            Search for TV shows to start tracking your progress.
          </p>
        </div>
      ) : (
        <div
          aria-label="Currently watching titles"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {activeShows.map(({ title, nextEpisode }) => (
            <ShowCard
              key={title.id}
              title={title}
              nextEpisode={nextEpisode}
              onSelect={onSelectTitle}
              onQuickIncrement={handleQuickIncrement}
            />
          ))}
        </div>
      )}

      {/* Celebration Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border bg-slate-900 border-emerald-500/60 text-emerald-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
