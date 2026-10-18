"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  titleName: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  titleName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, isDeleting]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        onClick={() => !isDeleting && onCancel()}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-full shrink-0 border border-rose-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="confirm-delete-title"
              className="text-lg font-semibold text-white leading-tight"
            >
              Delete Title
            </h3>
            <p
              id="confirm-delete-desc"
              className="mt-2 text-sm text-slate-400 leading-relaxed"
            >
              Are you sure you want to remove &quot;{titleName}&quot; from your library?
              This will delete all episode progress.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
