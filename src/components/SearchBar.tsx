"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { SearchModal } from "./SearchModal";
import type { TrackerStore } from "../lib/store";
import type { Title } from "../lib/types";

export interface SearchBarProps {
  placeholder?: string;
  store?: TrackerStore;
  customFetch?: typeof fetch;
  onShowAdded?: (title: Title, action: "watchlist" | "watching") => void;
  className?: string;
}

export function SearchBar({
  placeholder = "Search TV shows...",
  store,
  customFetch,
  onShowAdded,
  className = "",
}: SearchBarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            role="searchbox"
            aria-label="Search shows"
            placeholder={placeholder}
            value={query}
            onFocus={handleOpenModal}
            onClick={handleOpenModal}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsModalOpen(true);
            }}
            className="w-full bg-slate-900 hover:bg-slate-800/80 focus:bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-14 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition cursor-pointer"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      <SearchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialQuery={query}
        store={store}
        customFetch={customFetch}
        onShowAdded={onShowAdded}
      />
    </>
  );
}
