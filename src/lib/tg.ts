// Telegram Mini App: access to window.Telegram.WebApp in the browser.
// The telegram-web-app.js script is included in app/layout.tsx.

type WebApp = {
  initData: string;
  platform?: string; // "tdesktop", "macos", "web", "weba", "android", "ios"…
  isFullscreen?: boolean;
  requestFullscreen?(): void;
  initDataUnsafe: { user?: { id: number; allows_write_to_pm?: boolean }; start_param?: string };
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  requestWriteAccess?(cb?: (allowed: boolean) => void): void;
  openTelegramLink?(url: string): void;
  isVersionAtLeast?(v: string): boolean;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    selectionChanged(): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

/** WebApp if the site is open inside Telegram (signed data present), otherwise null. */
export function telegram(): WebApp | null {
  if (typeof window === "undefined") return null;
  const app = window.Telegram?.WebApp;
  return app && app.initData ? app : null;
}

/** A light haptic tap: only in Telegram, a no-op in a browser. */
export function haptic(kind: "tap" | "select" | "success" = "tap") {
  const h = telegram()?.HapticFeedback;
  if (!h) return;
  if (kind === "tap") h.impactOccurred("light");
  else if (kind === "select") h.selectionChanged();
  else h.notificationOccurred("success");
}
