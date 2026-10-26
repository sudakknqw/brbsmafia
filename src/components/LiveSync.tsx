"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncTimezone } from "@/app/actions";
import { addDays, DAY_START_HOUR, gamingDay, zonedToUtc } from "@/lib/time";

/**
 * Live updates: when someone changes something, the page re-renders.
 * Also stores the browser's time zone so times are shown locally.
 */
export function LiveSync({ timezone, meId }: { timezone: string; meId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== timezone) {
      syncTimezone(browserTz).then((changed) => changed && router.refresh());
    }
  }, [timezone, router]);

  // A new gaming day starts at 08:00; an open tab re-renders by itself:
  // "Today" moves to the next tile, and on Monday the week changes.
  useEffect(() => {
    const now = new Date();
    const next = zonedToUtc(addDays(gamingDay(now, timezone), 1), DAY_START_HOUR, timezone);
    const t = setTimeout(() => router.refresh(), next.getTime() - now.getTime() + 5_000);
    return () => clearTimeout(t);
  }, [timezone, router]);

  useEffect(() => {
    const supabase = createClient();
    // Our own changes already came with the server response, so don't re-render twice.
    const refresh = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const row = { ...payload.old, ...payload.new };
      if (row.user_id === meId || row.added_by === meId || row.id === meId) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase.channel("crew");
    for (const table of ["day_entries", "wants", "games", "profiles", "members", "gatherings", "gathering_members"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router, meId]);

  return null;
}
