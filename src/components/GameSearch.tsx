"use client";

import { useEffect, useState, useTransition } from "react";
import { addGame } from "@/app/actions";
import { steamArt } from "@/lib/steam";

type Result = { appid: number; name: string };

/**
 * Поиск игры в Steam. Найденная игра добавляется в общую библиотеку
 * (если её там ещё нет) и сразу отдаётся наружу через onPick.
 */
export function GameSearch({ onPick }: { onPick: (gameId: number, fromSteam: boolean) => void }) {
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
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const pick = (input: { steamAppId?: number; name: string }) =>
    start(async () => {
      const id = await addGame(input);
      if (id) onPick(id, !!input.steamAppId);
    });

  return (
    <div className={`transition ${pending ? "pointer-events-none opacity-50" : ""}`}>
      <div className="relative mb-4">
        <svg className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Название игры"
          className="w-full rounded-full bg-glass py-3.5 pr-4 pl-11 text-[16px] outline-none placeholder:text-faint focus:bg-glass2"
        />
      </div>

      {q.length < 2 && <p className="px-1 text-[15px] text-faint">Ищем в Steam. Игры не из Steam тоже можно добавить.</p>}

      {q.length >= 2 && (
        <ul className="-mx-2">
          {loading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-2">
                <div className="skeleton h-10 w-[86px] rounded-md" />
                <div className="skeleton h-4 w-40 rounded" />
              </li>
            ))}
          {!loading &&
            results.map((r) => (
              <li key={r.appid}>
                <button
                  onClick={() => pick({ steamAppId: r.appid, name: r.name })}
                  className="anim-fade flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-glass"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={steamArt(r.appid).header} alt="" className="h-10 w-[86px] shrink-0 rounded-md bg-glass object-cover" />
                  <span className="truncate text-[15px]">{r.name}</span>
                </button>
              </li>
            ))}
          {!loading && (
            <li>
              <button onClick={() => pick({ name: q })} className="w-full rounded-2xl px-2 py-3 text-left text-[15px] text-dim transition hover:bg-glass hover:text-fg">
                Добавить «{q}» без Steam
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
