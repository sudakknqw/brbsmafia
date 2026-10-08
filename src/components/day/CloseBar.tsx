"use client";

export function CloseBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-8 sm:pt-6">
      <button
        autoFocus
        onClick={onClose}
        aria-label="Закрыть день"
        className="flex size-10 items-center justify-center rounded-full bg-glass2 backdrop-blur-md transition hover:scale-105 hover:bg-white/20 active:scale-95"
      >
        <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
