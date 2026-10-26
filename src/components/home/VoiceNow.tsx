"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import { haptic } from "@/lib/tg";
import type { VoiceState } from "@/lib/voice";

const OFF: VoiceState = { available: false };
const POLL_MS = 60_000;

// Made-up data for /preview: there's no login there, so the server would answer "unavailable" anyway.
const MOCK: VoiceState = {
  available: true,
  invite: "https://discord.gg/example",
  channels: [
    { id: "1", name: "Общий", people: [{ username: "kirill", avatar_url: null }, { username: "dasha", avatar_url: null }, { username: "max", avatar_url: null }] },
    { id: "2", name: "Катка", people: [{ username: "lena", avatar_url: null }] },
  ],
};

function Speaker({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor" />
      <path d="M10.5 5.6a3.2 3.2 0 0 1 0 4.8M12.4 3.8a5.8 5.8 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "Who is in voice" badge in the home header. Polls the server once a minute
 * while the tab is visible; if nobody is there or the Discord widget is off, there's no badge at all.
 */
export function VoiceNow() {
  const pathname = usePathname();
  const preview = process.env.NODE_ENV !== "production" && pathname.startsWith("/preview");
  const [state, setState] = useState<VoiceState>(preview ? MOCK : OFF);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    // Network error: keep the last result so the badge doesn't flicker on one failed request.
    const load = () =>
      fetch("/api/discord/voice", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<VoiceState>) : OFF))
        .then((s) => alive && setState(s))
        .catch(() => undefined);
    const poll = () => {
      clearInterval(timer);
      load();
      timer = setInterval(load, POLL_MS);
    };
    // App in the background: stop polling; back in front: refresh right away.
    const onVisibility = () => (document.visibilityState === "visible" ? poll() : clearInterval(timer));
    if (document.visibilityState === "visible") poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [preview]);

  const channels = state.available ? state.channels : [];
  const people = channels.flatMap((c) => c.people);
  const invite = state.available ? state.invite : null;

  return (
    <>
      {people.length > 0 && (
        <button
          onClick={() => {
            haptic("tap");
            setOpen(true);
          }}
          aria-label={`${people.length} в голосовом Discord`}
          className="anim-fade flex h-[30px] items-center gap-1.5 rounded-full bg-black/45 pr-3 pl-2.5 text-[13px] font-medium text-fg transition hover:bg-black/60 active:scale-[0.97]"
        >
          <Speaker />
          <span className="flex items-center">
            {people.slice(0, 3).map((p, i) => (
              <Avatar
                key={i}
                id={p.username}
                name={p.username}
                url={p.avatar_url}
                size={20}
                ring="#161619"
                className={`anim-pop ${i ? "-ml-1.5" : ""}`}
              />
            ))}
          </span>
          <span className="tabular-nums">
            {people.length}
            {/* On narrow phones the wordmark and avatar are next to it, so only the number is shown */}
            <span className="hidden min-[400px]:inline"> в голосовом</span>
          </span>
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="В голосовом">
        {channels.length ? (
          <div className="space-y-5">
            {channels.map((c) => (
              <section key={c.id}>
                <h3 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-dim">
                  <Speaker size={13} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto text-faint tabular-nums">{c.people.length}</span>
                </h3>
                <ul className="space-y-1">
                  {c.people.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-2xl bg-glass px-3 py-2.5">
                      <Avatar id={p.username} name={p.username} url={p.avatar_url} size={30} />
                      <span className="truncate text-[15px]">{p.username}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-dim">Сейчас в голосовых никого.</p>
        )}
        {invite && (
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-fg px-6 py-3 text-[16px] font-semibold text-ink transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Открыть Discord
          </a>
        )}
      </Sheet>
    </>
  );
}
