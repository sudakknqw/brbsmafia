"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/lib/usePresence";

/**
 * Bottom sheet on phones, centered dialog on desktop.
 * Rendered straight into body so art blocks can't cover it.
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

  // A closed sheet stays visible briefly: it slides down (fades on desktop) instead of vanishing.
  const { mounted, closing } = usePresence(open, 260);
  // While leaving, show what was inside at the moment of closing (callers often reset it immediately).
  const [last, setLast] = useState({ title, children });
  if (open && (last.title !== title || last.children !== children)) setLast({ title, children });
  const shown = closing ? last : { title, children };
  if (!mounted) return null;
  return createPortal(
    <div
      className={`${closing ? "anim-fade-out pointer-events-none" : "anim-fade"} fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-6`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={shown.title}
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? "anim-sheet-out" : "anim-sheet"} max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border-t border-line bg-[#141418] px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[28px] sm:border sm:pt-5`}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-glass2 sm:hidden" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">{shown.title}</h2>
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
        {shown.children}
      </div>
    </div>,
    document.body,
  );
}
