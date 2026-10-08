"use client";

import { useEffect, useState } from "react";
import { telegram } from "@/lib/tg";

const MESSAGES: Record<string, string> = {
  "not-in-group": "Сюда пускают только участников нашей группы в Telegram.",
  "not-configured": "Бот ещё не настроен. Скажи тому, кто делал сайт.",
  "bad-signature": "Не получилось проверить вход. Закрой приложение и открой снова.",
};

/**
 * Вход без кнопок: внутри Telegram сразу отправляем подписанные данные на сервер
 * и уходим на главную. В обычном браузере — предложение открыть в Telegram.
 */
export function TelegramGate({ appUrl }: { appUrl: string | null }) {
  const [state, setState] = useState<"checking" | "outside" | { error: string }>("checking");

  useEffect(() => {
    // Скрипт Telegram грузится до страницы, но дадим ему мгновение на случай медленной сети.
    const timer = setTimeout(async () => {
      const app = telegram();
      if (!app) return setState("outside");
      try {
        const res = await fetch("/api/tg/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: app.initData }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (json.ok) {
          const day = app.initDataUnsafe.start_param;
          window.location.replace(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `/?day=${day}` : "/");
        } else setState({ error: json.error ?? "unknown" });
      } catch {
        setState({ error: "network" });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  if (state === "checking") {
    return <div className="mx-auto size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-label="Входим" />;
  }
  if (state === "outside") {
    return (
      <div className="space-y-4">
        <p className="text-[15px] text-dim">brbs mafia живёт в Telegram.</p>
        {appUrl && (
          <a
            href={appUrl}
            className="flex w-full items-center justify-center rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Открыть в Telegram
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[15px] text-dim">{MESSAGES[state.error] ?? "Не получилось войти. Закрой приложение и открой снова."}</p>
      <button
        onClick={() => window.location.reload()}
        className="w-full rounded-full bg-glass2 py-3.5 text-[16px] font-medium transition hover:bg-white/20"
      >
        Попробовать ещё раз
      </button>
    </div>
  );
}
