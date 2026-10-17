"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, Download, HardDrive } from "lucide-react";
import { TrackerStore, trackerStore } from "../lib/store";
import { exportBackup, downloadBackupJson, type BackupData } from "../lib/backup";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  store?: TrackerStore;
  onExport?: (backup: BackupData) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  store = trackerStore,
  onExport,
}: SettingsModalProps) {
  const [counts, setCounts] = useState<{ titles: number; episodes: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  const handleClose = useCallback(() => {
    setExportedSuccess(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let mounted = true;

    const loadCounts = async () => {
      try {
        const [titles, episodes] = await Promise.all([
          store.db.titles.count(),
          store.db.episodes.count(),
        ]);
        if (mounted) {
          setCounts({ titles, episodes });
        }
      } catch (err) {
        console.error("Failed to load title and episode counts:", err);
      }
    };

    loadCounts();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, store, handleClose]);

  if (!isOpen) {
    return null;
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await exportBackup(store);
      downloadBackupJson(backup);
      setExportedSuccess(true);
      if (onExport) {
        onExport(backup);
      }
    } catch (err) {
      console.error("Failed to export backup:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Data Management Section */}
          <section aria-labelledby="data-management-title" className="space-y-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-400" />
              <h3
                id="data-management-title"
                className="text-base font-medium text-white"
              >
                Data Management
              </h3>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              All show tracking data is stored locally in your browser. Export a JSON backup to keep a safe copy of your library or transfer it to another device.
            </p>

            {/* Counts Display */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Stored Records
              </div>
              {counts === null ? (
                <div className="text-sm text-slate-400">Loading stored records...</div>
              ) : (
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium text-slate-200">
                    <span className="text-indigo-400 font-bold">
                      {counts.titles} {counts.titles === 1 ? "title" : "titles"}
                    </span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="font-medium text-slate-200">
                    <span className="text-indigo-400 font-bold">
                      {counts.episodes} {counts.episodes === 1 ? "episode" : "episodes"}
                    </span>
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Includes all watched history, status, ratings, and notes.
              </p>
            </div>

            {/* Export Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? "Exporting..." : "Export Backup (JSON)"}</span>
              </button>

              {exportedSuccess && (
                <span className="text-xs text-emerald-400 font-medium">
                  Backup exported successfully!
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
