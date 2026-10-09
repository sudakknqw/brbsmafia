"use client";

import { useState } from "react";
import { DAY_HOURS } from "@/lib/time";
import { pct, type Range } from "./timeScale";

/**
 * Заметка к дню под полосой времени: мелко, курсивом, в одну строку.
 * Тянется от начала полосы вправо (или к её концу влево, если полоса во второй
 * половине дня). Полный текст — при наведении, а на телефоне — по нажатию.
 */
export function DayNote({ text, range, className = "" }: { text: string; range: Range; className?: string }) {
  const [open, setOpen] = useState(false);
  const late = range[0] >= DAY_HOURS / 2;
  return (
    <div
      className={`pointer-events-none absolute flex ${late ? "justify-end" : ""} ${className}`}
      style={late ? { left: 0, right: pct(DAY_HOURS - range[1]) } : { left: pct(range[0]), right: 0 }}
    >
      <button
        type="button"
        title={text}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className={`pointer-events-auto max-w-full text-[11px] leading-[14px] text-faint italic outline-none sm:text-[12px] ${
          open
            ? `relative z-10 -mx-2 -my-1 rounded-lg border border-line bg-[#1a1a1f] px-2 py-1 whitespace-normal text-dim ${late ? "text-right" : "text-left"}`
            : "truncate"
        }`}
      >
        {text}
      </button>
    </div>
  );
}
