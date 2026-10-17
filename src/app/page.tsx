import React from "react";
import { Tv, Film, Bookmark, CheckCircle2, XCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Tv className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Show Tracker
            </h1>
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

          <section aria-label="Tracked titles" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="col-span-full text-center py-12 text-slate-500">
              <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">No titles tracked yet</p>
              <p className="text-sm mt-1">Search for movies or TV shows to start tracking.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
