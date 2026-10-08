"use client";

import { useEffect } from "react";
import { telegram } from "@/lib/tg";

/**
 * Настройка окна мини-приложения: на весь экран, цвета под сайт, свайп вниз
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
