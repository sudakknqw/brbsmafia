"use client";

export function CloseBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl justify-end px-4 pt-[max(calc(1rem+var(--tg-safe-area-inset-top,0px)+var(--tg-content-safe-area-inset-top,0px)),env(safe-area-inset-top))] pb-4 sm:px-8 sm:pt-[calc(1.5rem+var(--tg-safe-area-inset-top,0px)+var(--tg-content-safe-area-inset-top,0px))]">
      <button
        autoFocus
        onClick={onClose}
        aria-label="Закрыть день"
        className="flex size-10 items-center justify-center rounded-full bg-white/15 transition hover:scale-105 hover:bg-white/20 active:scale-95"
      >
        <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
