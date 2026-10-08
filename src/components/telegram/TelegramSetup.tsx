"use client";

import { useEffect } from "react";
import { telegram } from "@/lib/tg";

/**
 * Настройка окна мини-приложения: на весь экран (на компьютере — полноэкранно), цвета под сайт, свайп вниз
 * не закрывает приложение (мешал бы тянуть полосу времени). Один раз просим
 * разрешение писать в личку — для напоминаний за час до игры.
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
    // На компьютере — сразу во весь экран, как обычный сайт (Telegram 8.0+).
    // На телефоне оставляем шапку Telegram: полноэкранный режим там прячет её.
    if (["tdesktop", "macos"].includes(app.platform ?? "") && app.isVersionAtLeast?.("8.0") && !app.isFullscreen) {
      try {
        app.requestFullscreen?.();
      } catch {}
    }

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
