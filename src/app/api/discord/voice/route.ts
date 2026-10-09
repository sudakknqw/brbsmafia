import { NextResponse } from "next/server";
import { getViewer } from "@/lib/crew";
import { parseWidget, type VoiceState } from "@/lib/voice";

const OFF: VoiceState = { available: false };

// Кто сейчас в голосовых каналах. Берём из открытого виджета сервера (Настройки сервера → Виджет):
// он отдаётся без токена, но только если его включили. Выключен, не настроен, Discord лежит —
// отвечаем «недоступно», и значок на главной просто не показывается.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.isMember) return NextResponse.json(OFF, { status: 401 });

  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId || !/^\d+$/.test(guildId)) return NextResponse.json(OFF);

  try {
    // Полминуты кэша: восемь открытых вкладок не долбят Discord каждая по отдельности.
    const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    // 403 (код 50004) — виджет выключен, 404 — нет такого сервера.
    if (!res.ok) return NextResponse.json(OFF);
    return NextResponse.json(parseWidget(await res.json()));
  } catch {
    return NextResponse.json(OFF);
  }
}
