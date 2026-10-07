"use client";

import { useEffect, useState, useTransition } from "react";
import { addGame } from "@/app/actions";
import { steamCovers } from "@/lib/steam";
import type { Game } from "@/lib/types";
import { GameCover } from "./GameCover";

type Result = { appid: number; name: string };

/**
 * Поиск игры в Steam + недавние. Найденная игра добавляется на общую полку
 * (если её там ещё нет) и сразу отдаётся наружу через onPick.
 */
export function GameSearch({ recent, onPick }: { recent: Game[]; onPick: (gameId: number) => void }) {
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<{ q: string; items: Result[] }>({ q: "", items: [] });
  const [pending, start] = useTransition();
  const q = term.trim();
  const results = found.q === q ? found.items : [];
  const loading = q.length >= 2 && found.q !== q;

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { items: Result[] };
        setFound({ q, items: data.items ?? [] });
      } catch {
        if (!controller.signal.aborted) setFound({ q, items: [] });
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const pick = (input: { steamAppId?: number; name: string }) =>
    start(async () => {
      const id = await addGame(input);
      if (id) onPick(id);
    });

  return (
    <div className={pending ? "pointer-events-none opacity-60" : ""}>
      <input
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Поиск в Steam"
        className="mb-4 w-full rounded-xl bg-elev px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
      />

      {q.length < 2 && recent.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-dim">Недавние</p>
          <div className="grid grid-cols-4 gap-2">
            {recent.map((g) => (
              <button key={g.id} onClick={() => onPick(g.id)} className="text-left">
                <GameCover key={g.id} game={g} />
                <p className="mt-1 truncate text-xs text-dim">{g.name}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {q.length >= 2 && (
        <ul className="divide-y divide-line">
          {results.map((r) => (
            <li key={r.appid}>
              <button onClick={() => pick({ steamAppId: r.appid, name: r.name })} className="flex w-full items-center gap-3 py-2.5 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={steamCovers(r.appid).header} alt="" className="h-9 w-[77px] shrink-0 rounded-md bg-elev object-cover" />
                <span className="truncate text-[15px]">{r.name}</span>
              </button>
            </li>
          ))}
          {!loading && (
            <li>
              <button onClick={() => pick({ name: q })} className="w-full py-3 text-left text-[15px] text-accent">
                Добавить «{q}» без Steam
              </button>
            </li>
          )}
        </ul>
      )}
      {loading && <p className="py-3 text-sm text-dim">Ищем…</p>}
    </div>
  );
}
