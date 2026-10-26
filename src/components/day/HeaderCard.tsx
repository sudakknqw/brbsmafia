"use client";

import { useState } from "react";
import { gameArt, plateColor } from "@/lib/steam";
import type { Game } from "@/lib/types";

/** Wide game header: custom, from Steam, or a colored plate. */
export function HeaderCard({ game }: { game: Game }) {
  const sources = gameArt(game).header;
  const key = sources.join("|");
  const [failed, setFailed] = useState({ key, index: 0 });
  const index = failed.key === key ? failed.index : 0;
  const src = sources[index];

  if (!src) {
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
      src={src}
      alt={game.name}
      loading="lazy"
      onError={() => setFailed({ key, index: index + 1 })}
      className="aspect-[460/215] w-full rounded-xl bg-glass object-cover"
    />
  );
}
