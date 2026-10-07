import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { LiveSync } from "@/components/LiveSync";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { GameCover } from "@/components/GameCover";
import { DayEditor } from "@/components/day/DayEditor";
import { loadEntries, loadGames, loadMembers, loadRecentGameIds, MAX_DAY_GAMES, requireMember } from "@/lib/crew";
import { dayStats, entryFor } from "@/lib/overlap";
import { silentJoke } from "@/lib/jokes";
import { memberColor } from "@/lib/colors";
import { addDays, DAY_HOURS, dateLong, formatTime, gamingDay, hourStart, weekdayLong } from "@/lib/time";

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const { date: day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();

  const { supabase, profile: me } = await requireMember();
  const tz = me.timezone;
  const today = gamingDay(new Date(), tz);

  const [members, entries, games, recentIds] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, addDays(day, -1), addDays(day, 1)),
    loadGames(supabase),
    loadRecentGameIds(supabase, me.id),
  ]);
  const { freeHours, best } = dayStats(day, tz, members, entries);

  const hourLabels = Array.from({ length: DAY_HOURS + 1 }, (_, i) => formatTime(hourStart(day, i, tz), tz));

  const rows = members
    .map((m) => {
      const entry = entryFor(entries, m.id, day);
      const hours = freeHours.get(m.id) ?? [];
      const state = hours.length ? "free" : entry?.status === "busy" ? "busy" : "silent";
      return { m, entry, hours, state };
    })
    .sort((a, b) => ["free", "busy", "silent"].indexOf(a.state) - ["free", "busy", "silent"].indexOf(b.state));

  // Игры дня: что выбрали люди, отметившие этот день.
  const dayGames = games
    .map((g) => ({
      game: g,
      people: rows.filter((r) => r.entry?.game_ids.includes(g.id)).map((r) => r.m),
    }))
    .filter((x) => x.people.length)
    .sort((a, b) => b.people.length - a.people.length);

  const mine = entryFor(entries, me.id, day);
  const recent = recentIds.map((id) => games.find((g) => g.id === id)).filter((g) => !!g);
  const pct = (i: number) => `${(i / DAY_HOURS) * 100}%`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <LiveSync timezone={tz} />
      <Header me={me} back />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">
            {day === today ? "Сегодня" : day === addDays(today, 1) ? "Завтра" : weekdayLong(day)}
          </h1>
          <p className="text-[15px] text-dim">
            {weekdayLong(day)}, {dateLong(day)}
          </p>
        </div>
        <DayEditor
          day={day}
          hourLabels={hourLabels}
          initialHours={freeHours.get(me.id) ?? []}
          initialGames={mine?.game_ids ?? []}
          busy={mine?.status === "busy"}
          games={games}
          recent={recent}
          maxGames={MAX_DAY_GAMES}
        />
      </div>

      {/* Сводка окна */}
      <div className={`mb-4 rounded-2xl px-4 py-3 text-[15px] ${best ? "bg-ok/15 text-ok" : "bg-card text-dim"}`}>
        {best
          ? `Все вместе: ${hourLabels[best.from]} – ${hourLabels[best.to]} · свободны ${best.count} из ${members.length}`
          : "Пока никто не совпал"}
      </div>

      {/* Шкала по часам */}
      <section className="rounded-3xl bg-card p-4 sm:p-5">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div />
          <div className="relative mb-2 h-4 text-[11px] text-dim tabular-nums">
            {hourLabels.map((label, i) =>
              i % 4 === 0 ? (
                <span key={i} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(i) }}>
                  {label}
                </span>
              ) : null,
            )}
          </div>

          <div>
            {rows.map(({ m, state }) => (
              <div key={m.id} className={`flex h-11 items-center gap-2 ${state === "free" ? "" : "opacity-50"}`}>
                <Avatar id={m.id} name={m.name} url={m.avatar_url} size={24} />
                <span className="truncate text-sm">{m.id === me.id ? "Ты" : m.name}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {best && (
              <div
                className="pointer-events-none absolute inset-y-0 rounded-lg bg-ok/10 ring-[1.5px] ring-ok"
                style={{ left: pct(best.from), width: pct(best.to - best.from) }}
              />
            )}
            {rows.map(({ m, hours, state }) => (
              <div key={m.id} className="flex h-11 items-center">
                <div className="relative h-3.5 w-full rounded-full bg-elev">
                  {state === "free" &&
                    runs(hours).map(([a, b]) => (
                      <div
                        key={a}
                        className="absolute inset-y-0 rounded-full"
                        style={{ left: pct(a), width: pct(b - a), background: memberColor(m.id) }}
                        title={`${hourLabels[a]} – ${hourLabels[b]}`}
                      />
                    ))}
                  {state !== "free" && (
                    <span className={`absolute inset-y-0 left-3 flex items-center text-[11px] ${state === "silent" ? "italic text-faint" : "text-dim"}`}>
                      {state === "busy" ? "не может" : silentJoke(m.id, day)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Игры этого дня */}
      <section className="mt-8">
        <h2 className="mb-3 text-[20px] font-bold tracking-tight">Игры на этот день</h2>
        {dayGames.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dayGames.map(({ game, people }) => (
              <div key={game.id}>
                <GameCover key={game.id} game={game} shape="header" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[13px]">{game.name}</span>
                  <AvatarStack people={people} size={20} max={4} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dim">Никто ещё не предложил. Выбери игры, когда будешь отмечать время.</p>
        )}
      </section>
    </main>
  );
}

function runs(hours: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}
