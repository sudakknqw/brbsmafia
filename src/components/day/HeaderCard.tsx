"use client";

import { useState } from "react";
import { plateColor, steamArt } from "@/lib/steam";
import type { Game } from "@/lib/types";

/** Горизонтальная шапка игры из Steam. */
export function HeaderCard({ game }: { game: Game }) {
  const [failed, setFailed] = useState(!game.steam_appid);
  if (failed) {
    return (
      <div
        style={{ background: plateColor(game.name) }}
        className="flex aspect-[460/215] items-end rounded-xl p-3 text-[17px] font-semibold text-white"
      >
        {game.name}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={steamArt(game.steam_appid!).header}
      alt={game.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[460/215] w-full rounded-xl bg-glass object-cover"
    />
  );
}
