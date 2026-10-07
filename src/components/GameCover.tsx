"use client";

import { useState } from "react";
import { plateColor, steamCovers } from "@/lib/steam";
import type { Game } from "@/lib/types";

/**
 * Обложка из Steam. Если вертикальной нет — берём горизонтальную,
 * если и её нет (или игра не из Steam) — цветная плашка с названием.
 */
export function GameCover({
  game,
  shape = "portrait",
  className = "",
}: {
  game: Game;
  shape?: "portrait" | "header";
  className?: string;
}) {
  const sources = game.steam_appid
    ? shape === "portrait"
      ? [steamCovers(game.steam_appid).portrait, steamCovers(game.steam_appid).header]
      : [steamCovers(game.steam_appid).header]
    : [];
  const [index, setIndex] = useState(0);
  const src = sources[index];
  const aspect = shape === "portrait" ? "aspect-[2/3]" : "aspect-[460/215]";

  if (!src) {
    return (
      <div
        style={{ background: plateColor(game.name) }}
        className={`${aspect} flex items-end overflow-hidden rounded-xl p-2.5 text-sm font-semibold leading-tight text-white ${className}`}
      >
        {game.name}
      </div>
    );
  }

  const isFallbackHeader = shape === "portrait" && index === 1;
  return (
    <div className={`${aspect} relative overflow-hidden rounded-xl bg-elev ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={game.name}
        loading="lazy"
        onError={() => setIndex((i) => i + 1)}
        className={isFallbackHeader ? "absolute inset-x-0 top-1/2 w-full -translate-y-1/2" : "h-full w-full object-cover"}
      />
      {isFallbackHeader && (
        <span className="absolute inset-x-0 bottom-0 p-2.5 text-sm font-semibold leading-tight text-white">{game.name}</span>
      )}
    </div>
  );
}
