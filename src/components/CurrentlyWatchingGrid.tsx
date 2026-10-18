"use client";

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Tv } from "lucide-react";
import { ShowCard } from "./ShowCard";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";
import type { Title } from "../lib/types";

export interface CurrentlyWatchingGridProps {
  store?: TrackerStore;
  onSelectTitle?: (title: Title) => void;
}

export function CurrentlyWatchingGrid({
  store = defaultStore,
  onSelectTitle,
}: CurrentlyWatchingGridProps) {
  const activeShows = useLiveQuery(() => store.getActiveWatchingShows(), [store]);

  if (activeShows === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-full py-12 text-center text-slate-500">
          <p className="text-sm">Loading active shows...</p>
        </div>
      </div>
    );
  }

  if (activeShows.length === 0) {
    return (
      <div className="col-span-full text-center py-16 text-slate-500">
        <Tv className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
        <p className="text-base font-medium text-slate-300">
          No shows currently being watched
        </p>
        <p className="text-sm mt-1 text-slate-500">
          Search for TV shows to start tracking your progress.
        </p>
      </div>
    );
  }

  return (
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
        />
      ))}
    </div>
  );
}
