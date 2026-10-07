import Link from "next/link";
import { Header } from "@/components/Header";
import { LiveSync } from "@/components/LiveSync";
import { QuickActions } from "@/components/home/QuickActions";
import { GamesShelf } from "@/components/home/GamesShelf";
import { StatusRow } from "@/components/home/StatusRow";
import { AvatarStack } from "@/components/Avatar";
import { loadActiveWants, loadEntries, loadGames, loadMembers, requireMember } from "@/lib/crew";
import { dayStats, entryFor } from "@/lib/overlap";
import { addDays, dayNumber, gamingDay, hourStart, formatTime, weekdayLong, weekdayShort } from "@/lib/time";

export default async function Home() {
  const { supabase, profile: me } = await requireMember();
  const tz = me.timezone;
  const today = gamingDay(new Date(), tz);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [members, entries, games, wants] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, addDays(today, -1), addDays(today, 7)),
    loadGames(supabase),
    loadActiveWants(supabase),
  ]);

  const days = week.map((day) => ({ day, ...dayStats(day, tz, members, entries) }));
  const highlight = days.find((d) => d.best) ?? null;
  const total = members.length;

  const peopleIn = (d: (typeof days)[number]) =>
    d.best ? members.filter((m) => (d.freeHours.get(m.id) ?? []).includes(d.best!.from)) : [];

  // Чаще всего выбранная игра среди тех, кто в окне.
  const topGame = (d: (typeof days)[number]) => {
    const counts = new Map<number, number>();
    for (const m of peopleIn(d)) entryFor(entries, m.id, d.day)?.game_ids.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
    const [id] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return games.find((g) => g.id === id)?.name;
  };

  const myToday = entryFor(entries, me.id, today);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <LiveSync timezone={tz} />
      <Header me={me} />

      {/* Сегодня / ближайшее окно */}
      <Link href={`/day/${highlight?.day ?? today}`} className="block rounded-3xl bg-card p-5 transition hover:bg-[#232325]">
        {highlight?.best ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-dim">{highlight.day === today ? "Сегодня" : weekdayLong(highlight.day)}</p>
              <p className="mt-0.5 text-[34px] font-bold leading-tight tracking-tight tabular-nums">
                {formatTime(hourStart(highlight.day, highlight.best.from, tz), tz)} – {formatTime(hourStart(highlight.day, highlight.best.to, tz), tz)}
              </p>
              <p className="mt-1 text-sm text-dim">
                Свободны {highlight.best.count} из {total}
                {topGame(highlight) ? ` · чаще всего ${topGame(highlight)}` : ""}
              </p>
            </div>
            <AvatarStack people={peopleIn(highlight)} size={32} ring="#1c1c1e" max={8} />
          </div>
        ) : (
          <div>
            <p className="text-sm text-dim">Сегодня</p>
            <p className="mt-0.5 text-[28px] font-bold tracking-tight">Пока никто не совпал</p>
            <p className="mt-1 text-sm text-dim">Отметь, когда ты свободен — может, совпадёшь с кем-то.</p>
          </div>
        )}
      </Link>

      <QuickActions today={today} busyToday={myToday?.status === "busy"} />

      {/* Неделя */}
      <section className="mt-8">
        <h2 className="mb-3 text-[20px] font-bold tracking-tight">Неделя</h2>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d) => {
            const max = Math.max(...d.counts);
            const mine = entryFor(entries, me.id, d.day);
            return (
              <Link
                key={d.day}
                href={`/day/${d.day}`}
                className={`rounded-2xl bg-card px-1 py-3 text-center transition hover:bg-elev ${d.day === today ? "ring-[1.5px] ring-accent" : ""}`}
              >
                <p className="text-xs text-dim">{weekdayShort(d.day)}</p>
                <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{dayNumber(d.day)}</p>
                <div className="mx-auto mt-2 h-1 w-3/4 overflow-hidden rounded-full bg-elev2">
                  <div className="h-full rounded-full bg-ok" style={{ width: `${total ? (max / total) * 100 : 0}%`, opacity: max >= 2 ? 1 : 0.5 }} />
                </div>
                <span
                  className={`mx-auto mt-2 block size-1.5 rounded-full ${
                    mine?.status === "free" ? "bg-accent" : mine?.status === "busy" ? "bg-faint" : "bg-transparent"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </section>

      <StatusRow members={members} wants={wants} games={games} meId={me.id} />

      <GamesShelf games={games} wants={wants} members={members} meId={me.id} />
    </main>
  );
}
