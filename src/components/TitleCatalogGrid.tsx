"use client";

import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bookmark, CheckCircle2, XCircle, Tv } from "lucide-react";
import { TitleCatalogCard } from "./TitleCatalogCard";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { TrackerStore, trackerStore as defaultStore } from "../lib/store";
import type { Title, WatchStatus } from "../lib/types";
import { getShowWithEpisodes, toCreateEpisodeInput } from "../lib/tvmaze";

export interface TitleCatalogGridProps {
  status: WatchStatus;
  store?: TrackerStore;
  onSelectTitle?: (title: Title) => void;
  onTitleStatusChange?: (title: Title, newStatus: WatchStatus) => void;
  onTitleDeleted?: (titleId: string) => void;
  customFetch?: typeof fetch;
}

export function TitleCatalogGrid({
  status,
  store = defaultStore,
  onSelectTitle,
  onTitleStatusChange,
  onTitleDeleted,
  customFetch = fetch,
}: TitleCatalogGridProps) {
  const [titleToDelete, setTitleToDelete] = useState<Title | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const titles = useLiveQuery(
    async () => {
      const list = await store.getTitlesByStatus(status);
      return list.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    },
    [store, status]
  );

  const handleStartWatching = async (title: Title) => {
    try {
      if (title.type === "tv" && title.externalId !== null) {
        const episodes = await store.getEpisodes(title.id);
        if (episodes.length === 0) {
          try {
            const details = await getShowWithEpisodes(
              Number(title.externalId),
              customFetch
            );
            const eps = details.episodes.map((ep) =>
              toCreateEpisodeInput(ep, title.id)
            );
            await store.importEpisodesForTitle(title.id, eps);
          } catch {
            // Non-critical fallback if offline or API unreachable
          }
        }
      }

      await store.updateTitleStatus(title.id, "Watching");
      onTitleStatusChange?.(title, "Watching");
      setToast({
        message: `Started watching "${title.name}"`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to start watching "${title.name}"`,
        type: "error",
      });
    }
  };

  const handleResume = async (title: Title) => {
    try {
      await store.updateTitleStatus(title.id, "Watching");
      onTitleStatusChange?.(title, "Watching");
      setToast({
        message: `Resumed watching "${title.name}"`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to resume watching "${title.name}"`,
        type: "error",
      });
    }
  };

  const handleRewatch = async (title: Title) => {
    try {
      await store.updateTitleStatus(title.id, "Watching");
      onTitleStatusChange?.(title, "Watching");
      setToast({
        message: `Moved "${title.name}" back to Watching`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to update "${title.name}"`,
        type: "error",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!titleToDelete) return;

    setIsDeleting(true);
    const target = titleToDelete;
    try {
      await store.deleteTitle(target.id);
      onTitleDeleted?.(target.id);
      setTitleToDelete(null);
      setToast({
        message: `Removed "${target.name}" from your library`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : `Failed to delete "${target.name}"`,
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (titles === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-full py-12 text-center text-slate-500">
          <p className="text-sm">Loading titles...</p>
        </div>
      </div>
    );
  }

  if (titles.length === 0) {
    let EmptyIcon = Bookmark;
    let heading = "Your Watchlist is empty";
    let description = "Search to add titles to your watchlist.";

    if (status === "Completed") {
      EmptyIcon = CheckCircle2;
      heading = "No completed titles";
      description = "Titles you finish watching will appear here.";
    } else if (status === "Dropped") {
      EmptyIcon = XCircle;
      heading = "No dropped titles";
      description = "Titles you stop watching will appear here.";
    } else if (status === "Watching") {
      EmptyIcon = Tv;
      heading = "No shows currently being watched";
      description = "Search for TV shows to start tracking your progress.";
    }

    return (
      <div className="col-span-full text-center py-16 text-slate-500">
        <EmptyIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
        <p className="text-base font-medium text-slate-300">{heading}</p>
        <p className="text-sm mt-1 text-slate-500">{description}</p>
      </div>
    );
  }

  const ariaLabel =
    status === "Plan to Watch"
      ? "Watchlist titles"
      : status === "Completed"
      ? "Completed titles"
      : status === "Dropped"
      ? "Dropped titles"
      : "Tracked titles";

  return (
    <>
      <div
        aria-label={ariaLabel}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {titles.map((title) => (
          <TitleCatalogCard
            key={title.id}
            title={title}
            status={status}
            onSelect={onSelectTitle}
            onStartWatching={handleStartWatching}
            onResume={handleResume}
            onRewatch={handleRewatch}
            onRequestDelete={(t) => setTitleToDelete(t)}
          />
        ))}
      </div>

      <ConfirmDeleteModal
        isOpen={titleToDelete !== null}
        titleName={titleToDelete?.name ?? ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTitleToDelete(null)}
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
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
    </>
  );
}
