"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { SteamLinkForm } from "./SteamLinkForm";

/**
 * Пока у человека нет ссылки на Steam, при каждом входе просим её —
 * после заставки, чтобы окно не пряталось под ней.
 */
export function SteamPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.querySelector(".splash")) return;
      clearInterval(t);
      setOpen(true);
    }, 250);
    return () => clearInterval(t);
  }, []);

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Твой Steam">
      <p className="mb-5 text-[15px] leading-relaxed text-dim">
        Вставь ссылку на свой профиль Steam — игры, в которые компания чаще играет, будут выше в списках. Чтобы скопировать её, открой
        профиль в Steam, нажми правой кнопкой на пустое место и выбери «Скопировать адрес страницы».
      </p>
      <SteamLinkForm onSaved={() => setOpen(false)} />
      <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-full py-3 text-[15px] text-dim transition hover:text-fg">
        Позже
      </button>
    </Sheet>
  );
}
