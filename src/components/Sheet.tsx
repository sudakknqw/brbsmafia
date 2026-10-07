"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Шторка снизу на телефоне, окно по центру на компьютере.
 * Рисуется прямо в body, чтобы её не перекрывали блоки с артом.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-md sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border-t border-line bg-[#141418]/95 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:max-w-lg sm:rounded-[28px] sm:border sm:pt-5"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-glass2 sm:hidden" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-glass text-dim transition hover:bg-glass2 hover:text-fg"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
