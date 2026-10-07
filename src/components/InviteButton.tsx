"use client";

import { useState, useTransition } from "react";
import { createInvite } from "@/app/actions";
import { Sheet } from "./Sheet";

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const openSheet = () => {
    setOpen(true);
    setCopied(false);
    if (!link) {
      start(async () => {
        const code = await createInvite();
        setLink(`${window.location.origin}/invite/${code}`);
      });
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };

  return (
    <>
      <button onClick={openSheet} aria-label="Пригласить" className="flex size-[34px] items-center justify-center rounded-full bg-glass text-fg backdrop-blur-md transition hover:bg-glass2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="9" cy="8" r="4" />
          <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Пригласить в brbs mafia">
        <p className="mb-4 text-sm text-dim">Ссылка действует 7 дней. Отправь её другу в Discord.</p>
        <div className="mb-3 truncate rounded-2xl bg-glass px-4 py-3.5 text-[15px]">{pending || !link ? "Создаём ссылку…" : link}</div>
        <button
          onClick={copy}
          disabled={!link}
          className="w-full rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {copied ? "Скопировано" : "Скопировать ссылку"}
        </button>
      </Sheet>
    </>
  );
}
