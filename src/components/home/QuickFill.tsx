"use client";

import { useState, useTransition } from "react";
import { quickFill } from "@/app/actions";

const OPTIONS = [
  { kind: "tomorrow", label: "Завтра вечером" },
  { kind: "weekend", label: "Выходные" },
] as const;

/** Quick buttons: mark a typical time in one tap. */
export function QuickFill() {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.kind}
          disabled={pending}
          onClick={() => {
            setDone(o.kind);
            start(() => quickFill(o.kind).catch(() => undefined));
          }}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
            done === o.kind ? "bg-fg text-ink" : "bg-glass hover:bg-glass2"
          }`}
        >
          {done === o.kind && !pending ? "Отмечено" : o.label}
        </button>
      ))}
    </div>
  );
}
