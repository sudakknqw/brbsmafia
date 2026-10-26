"use client";

import { useEffect } from "react";
import { telegram } from "@/lib/tg";

/**
 * Mini App window setup: expanded, colors matching the site, swipe-down
 * doesn't close the app (it would interfere with dragging the time bar). Asks once
 * for permission to send private messages, for the one-hour reminders.
 */
export function TelegramSetup() {
  useEffect(() => {
    const app = telegram();
    if (!app) return;
    app.ready();
    app.expand();
    app.setHeaderColor?.("#050507");
    app.setBackgroundColor?.("#050507");
    app.disableVerticalSwipes?.();
    if (app.initDataUnsafe.user && !app.initDataUnsafe.user.allows_write_to_pm) {
      try {
        if (localStorage.getItem("brbs-write-asked")) return;
        localStorage.setItem("brbs-write-asked", "1");
      } catch {}
      app.requestWriteAccess?.();
    }
  }, []);
  return null;
}
