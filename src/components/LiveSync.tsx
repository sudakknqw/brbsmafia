"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncTimezone } from "@/app/actions";

/**
 * Живые обновления: кто-то что-то поменял — страница перерисовывается.
 * Заодно запоминает часовой пояс браузера, чтобы время было «своим».
 */
export function LiveSync({ timezone }: { timezone: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== timezone) {
      syncTimezone(browserTz).then((changed) => changed && router.refresh());
    }
  }, [timezone, router]);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase.channel("crew");
    for (const table of ["day_entries", "wants", "games", "profiles", "members"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
