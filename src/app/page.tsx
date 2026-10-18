"use client";

import React, { useState } from "react";
import { Tv, Bookmark, CheckCircle2, XCircle, Settings } from "lucide-react";
import { SearchBar } from "../components/SearchBar";
import { SettingsModal } from "../components/SettingsModal";
import { CurrentlyWatchingGrid } from "../components/CurrentlyWatchingGrid";
import { ShowDetailModal } from "../components/ShowDetailModal";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";
import type { Title } from "../lib/types";

export interface HomePageProps {
  store?: TrackerStore;
}

export default function Home({ store = defaultStore }: HomePageProps = {}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Tv className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Show Tracker
            </h1>
          </div>

          <div className="flex items-center space-x-3 flex-1 justify-end max-w-md">
            <SearchBar store={store} />
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shrink-0"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <div
            role="tablist"
            aria-label="Watch status navigation"
            className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto"
          >
            <button
              role="tab"
              aria-selected="true"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white"
            >
              <Tv className="w-4 h-4" />
              <span>Watching</span>
            </button>
            <button
              role="tab"
              aria-selected="false"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <Bookmark className="w-4 h-4" />
              <span>Watchlist</span>
            </button>
            <button
              role="tab"
              aria-selected="false"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
            </button>
            <button
              role="tab"
              aria-selected="false"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <XCircle className="w-4 h-4" />
              <span>Dropped</span>
            </button>
          </div>

          <section aria-label="Currently Watching">
            <h2 className="sr-only">Currently Watching</h2>
            <CurrentlyWatchingGrid
              store={store}
              onSelectTitle={(title) => setSelectedTitle(title)}
            />
          </section>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        store={store}
      />

      <ShowDetailModal
        isOpen={!!selectedTitle}
        title={selectedTitle}
        onClose={() => setSelectedTitle(null)}
        store={store}
      />
    </div>
  );
}
