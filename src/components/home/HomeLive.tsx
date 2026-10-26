"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { toggleWant } from "@/app/actions";
import { AmbientTail } from "@/components/AmbientTail";
import { DayOverlayProvider } from "@/components/day/DayOverlay";
import { Splash } from "@/components/splash/Splash";
import { MAX_WANTS } from "@/lib/limits";
import { haptic } from "@/lib/tg";
import type { Want } from "@/lib/types";
import { buildHome, type CrewData } from "@/lib/views";
import { Library } from "./Library";
import { Spotlight } from "./Spotlight";
import { StatusRow } from "./StatusRow";
import { WeekRow } from "./WeekRow";

/**
 * The home page is computed in the browser from live wants: tap a game and
 * the library, statuses and the header (game of the day, its art and color) change instantly,
 * without waiting for the server. The server response then simply matches.
 */
export function HomeLive({ data, footer }: { data: CrewData; footer: ReactNode }) {
  const meId = data.me.id;
  const [, start] = useTransition();
  const [wants, applyToggle] = useOptimistic(data.wants, (state: Want[], gameId: number) => {
    const mine = state.filter((w) => w.user_id === meId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (mine.some((w) => w.game_id === gameId)) return state.filter((w) => !(w.user_id === meId && w.game_id === gameId));
    // No more than three: the oldest want makes room (same as on the server).
    const drop = mine.length >= MAX_WANTS ? mine[0].game_id : null;
    return [
      ...state.filter((w) => !(w.user_id === meId && w.game_id === drop)),
      { user_id: meId, game_id: gameId, created_at: new Date().toISOString() },
    ];
  });

  const toggle = (gameId: number) =>
    start(async () => {
      haptic("tap");
      applyToggle(gameId);
      await toggleWant(gameId).catch(() => undefined);
    });

  const live = { ...data, wants };
  const home = buildHome(live);

  return (
    <DayOverlayProvider data={live}>
      <Splash members={data.members} />
      <Spotlight me={data.me} spotlight={home.spotlight} gathering={home.gathering} today={home.today} />
      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        <WeekRow week={home.week} total={home.total} />
        <StatusRow statuses={home.statuses} meId={meId} viewerTz={data.me.timezone} />
        <Library games={data.games} wants={wants} members={data.members} meId={meId} onToggle={toggle} />
        {footer}
      </main>
    </DayOverlayProvider>
  );
}
