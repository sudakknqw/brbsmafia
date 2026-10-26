"use client";

import { useState } from "react";
import { DAY_HOURS } from "@/lib/time";
import { pct, type Range } from "./timeScale";

/**
 * Day note under the time bar: small, italic, one line.
 * Runs right from the bar's start (or left to its end if the bar is in the second
 * half of the day). Full text on hover, or on tap on phones.
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
