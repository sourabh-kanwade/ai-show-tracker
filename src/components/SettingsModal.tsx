"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Download,
  Upload,
  HardDrive,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { TrackerStore, trackerStore } from "../lib/store";
import {
  exportBackup,
  downloadBackupJson,
  validateBackup,
  importBackup,
  type BackupData,
} from "../lib/backup";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  store?: TrackerStore;
  onExport?: (backup: BackupData) => void;
  onImport?: (backup: BackupData) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  store = trackerStore,
  onExport,
  onImport,
}: SettingsModalProps) {
  const [counts, setCounts] = useState<{ titles: number; episodes: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshCounts = useCallback(async () => {
    try {
      const [titles, episodes] = await Promise.all([
        store.db.titles.count(),
        store.db.episodes.count(),
      ]);
      setCounts({ titles, episodes });
    } catch (err) {
      console.error("Failed to load title and episode counts:", err);
    }
  }, [store]);

  const handleClose = useCallback(() => {
    setExportedSuccess(false);
    setImportSuccess(false);
    setImportError(null);
    setPendingBackup(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const readFileText = (file: File): Promise<string> => {
    if (typeof file.text === "function") {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await readFileText(file);
      const validation = validateBackup(text);
      if (!validation.valid || !validation.data) {
        setImportError(validation.error || "Invalid backup schema.");
        e.target.value = "";
        return;
      }

      setPendingBackup(validation.data);
    } catch (err) {
      console.error("Failed to read file:", err);
      setImportError("Failed to read backup file.");
      e.target.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) {
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      await importBackup(pendingBackup, store, { overwrite: true });
      await refreshCounts();
      setImportSuccess(true);
      if (onImport) {
        onImport(pendingBackup);
      }
      setPendingBackup(null);
    } catch (err) {
      console.error("Failed to import backup:", err);
      setImportError(err instanceof Error ? err.message : "Failed to import backup.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCancelImport = () => {
    setPendingBackup(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
              All show tracking data is stored locally in your browser. Export a JSON backup to keep a safe copy of your library, or restore previously exported data.
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

            {/* Confirmation Dialog / Prompt */}
            {pendingBackup && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-import-title"
                aria-describedby="confirm-import-desc"
                className="p-4 bg-amber-950/40 border border-amber-600/40 rounded-lg space-y-3"
              >
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 id="confirm-import-title" className="text-sm font-semibold">
                    Confirm Backup Import
                  </h4>
                </div>
                <p id="confirm-import-desc" className="text-xs text-slate-300 leading-relaxed">
                  Importing this backup will overwrite your current library. You are about to import{" "}
                  <span className="font-semibold text-white">
                    {pendingBackup.titles.length}{" "}
                    {pendingBackup.titles.length === 1 ? "title" : "titles"}
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-white">
                    {pendingBackup.episodes.length}{" "}
                    {pendingBackup.episodes.length === 1 ? "episode" : "episodes"}
                  </span>
                  . Are you sure you want to proceed?
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-sm"
                  >
                    {isImporting ? "Importing..." : "Confirm Import"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelImport}
                    disabled={isImporting}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Error Feedback */}
            {importError && (
              <div
                role="alert"
                className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Success Feedback */}
            {importSuccess && (
              <div
                role="status"
                className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Backup imported successfully! Your library has been restored.</span>
              </div>
            )}

            {exportedSuccess && (
              <div className="text-xs text-emerald-400 font-medium">
                Backup exported successfully!
              </div>
            )}

            {/* Export & Import Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || isImporting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? "Exporting..." : "Export Backup (JSON)"}</span>
              </button>

              <label
                htmlFor="backup-file-input"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm transition-colors border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500 cursor-pointer shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Import Backup (JSON)</span>
                <input
                  ref={fileInputRef}
                  id="backup-file-input"
                  type="file"
                  accept=".json,application/json"
                  aria-label="Import Backup (JSON)"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isImporting}
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

