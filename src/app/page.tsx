"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Tv, Bookmark, CheckCircle2, XCircle, Settings } from "lucide-react";
import { SearchBar } from "../components/SearchBar";
import { SettingsModal } from "../components/SettingsModal";
import { CurrentlyWatchingGrid } from "../components/CurrentlyWatchingGrid";
import { TitleCatalogGrid } from "../components/TitleCatalogGrid";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";
import type { WatchStatus } from "../lib/types";

export interface HomeProps {
  store?: TrackerStore;
}

export default function Home({ store = defaultStore }: HomeProps = {}) {
  const [activeTab, setActiveTab] = useState<WatchStatus>("Watching");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const titles = useLiveQuery(() => store.getTitlesByStatus(), [store]);

  const counts: Record<WatchStatus, number> = {
    Watching: 0,
    "Plan to Watch": 0,
    Completed: 0,
    Dropped: 0,
  };

  if (titles) {
    for (const title of titles) {
      if (counts[title.status] !== undefined) {
        counts[title.status]++;
      }
    }
  }

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
              aria-selected={activeTab === "Watching"}
              onClick={() => setActiveTab("Watching")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "Watching"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Watching</span>
              {counts["Watching"] > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-indigo-900/80 text-indigo-200">
                  {counts["Watching"]}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "Plan to Watch"}
              onClick={() => setActiveTab("Plan to Watch")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "Plan to Watch"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Watchlist</span>
              {counts["Plan to Watch"] > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {counts["Plan to Watch"]}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "Completed"}
              onClick={() => setActiveTab("Completed")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "Completed"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
              {counts["Completed"] > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {counts["Completed"]}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "Dropped"}
              onClick={() => setActiveTab("Dropped")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "Dropped"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>Dropped</span>
              {counts["Dropped"] > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {counts["Dropped"]}
                </span>
              )}
            </button>
          </div>

          {activeTab === "Watching" && (
            <section aria-label="Currently Watching">
              <h2 className="sr-only">Currently Watching</h2>
              <CurrentlyWatchingGrid store={store} />
            </section>
          )}

          {activeTab === "Plan to Watch" && (
            <section aria-label="Watchlist">
              <h2 className="sr-only">Watchlist</h2>
              <TitleCatalogGrid status="Plan to Watch" store={store} />
            </section>
          )}

          {activeTab === "Completed" && (
            <section aria-label="Completed">
              <h2 className="sr-only">Completed</h2>
              <TitleCatalogGrid status="Completed" store={store} />
            </section>
          )}

          {activeTab === "Dropped" && (
            <section aria-label="Dropped">
              <h2 className="sr-only">Dropped</h2>
              <TitleCatalogGrid status="Dropped" store={store} />
            </section>
          )}
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        store={store}
      />
    </div>
  );
}
