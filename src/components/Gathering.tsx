"use client";

import { useState, useTransition } from "react";
import { cancelGathering, setGatheringStatus, startGathering } from "@/app/actions";
import { AvatarStack } from "./Avatar";
import { NamesHint } from "./NamesHint";
import type { GatheringView } from "@/lib/views";
import { who } from "@/lib/words";
import { DECLINE, JOIN, pick } from "@/lib/phrases";

/** Кнопка «Начать сессию»: одно нажатие — сессия на лучшее окно дня и сообщение в Discord. */
export function StartGathering({ day, gameId, gameName }: { day: string; gameId: number; gameName: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startGathering(day, gameId).catch(() => ({ error: "Не получилось начать сессию. Попробуй ещё раз." }));
            if (res.error) setError(res.error);
          })
        }
        title={`Сессия в ${gameName} на общее окно, с упоминанием в Discord`}
        className="rounded-full bg-glass2 px-5 py-3 text-[16px] font-medium backdrop-blur-md transition hover:bg-white/20 active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? "Создаём…" : "Начать сессию"}
      </button>
      {error && <span className="mt-2 text-[13px] text-bad">{error}</span>}
    </span>
  );
}

/** Идущая сессия: кто позвал, когда, кто в деле — и свои кнопки. */
export function GatheringInfo({ gathering, meId }: { gathering: GatheringView; meId: string }) {
  const [status, setStatus] = useState(gathering.myStatus);
  const [cancelled, setCancelled] = useState(false);
  const [, start] = useTransition();

  // Своя отметка поверх серверных данных — кнопки отвечают сразу.
  const me = [...gathering.going, ...gathering.notGoing].find((m) => m.id === meId) ?? null;
  const going = gathering.going.filter((m) => m.id !== meId);
  if (status === "in" && me) going.unshift(me);
  const names = going.map((m) => (m.id === meId ? "ты" : m.name));

  const choose = (next: "in" | "out") => {
    const value = status === next ? null : next;
    setStatus(value);
    start(() => setGatheringStatus(gathering.id, value).catch(() => undefined));
  };

  if (cancelled) return null;
  return (
    <div className="anim-rise">
      <p className="text-[17px] font-semibold tabular-nums">
        Сессия в {gathering.gameName}, {gathering.when}
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <NamesHint names={going.map((m) => m.name)} className="gap-3">
          {going.length > 0 && <AvatarStack people={going} size={30} max={8} />}
          <span className="text-[15px] text-dim">
            {gathering.mine ? "Твоя сессия" : `Зовёт ${gathering.creator?.name ?? "кто-то"}`}
            {names.length ? `. ${who(names, "В деле", "В деле")}` : ". Пока никто не отозвался"}
          </span>
        </NamesHint>
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          onClick={() => choose("in")}
          aria-pressed={status === "in"}
          className="inline-flex items-center gap-2 rounded-full bg-fg px-6 py-3 text-[16px] font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.97]"
        >
          {status === "in" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L19 7" />
            </svg>
          )}
          {status === "in" ? "Ты в деле" : pick(JOIN, gathering.id)}
        </button>
        <button
          onClick={() => choose("out")}
          aria-pressed={status === "out"}
          className={`rounded-full px-5 py-3 text-[16px] font-medium backdrop-blur-md transition active:scale-[0.97] ${
            status === "out" ? "bg-bad text-white" : "bg-glass2 hover:bg-white/20"
          }`}
        >
          {pick(DECLINE, gathering.id)}
        </button>
        {gathering.mine && (
          <button
            onClick={() => {
              if (!confirm("Отменить сессию? Сообщение в Discord тоже уберётся.")) return;
              setCancelled(true);
              start(() => cancelGathering(gathering.id).catch(() => undefined));
            }}
            className="rounded-full px-4 py-3 text-[16px] font-medium text-dim transition hover:text-fg"
          >
            Отменить сессию
          </button>
        )}
      </div>
    </div>
  );
}
