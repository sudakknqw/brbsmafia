import { NextResponse } from "next/server";
import { getViewer } from "@/lib/crew";
import { parseWidget, type VoiceState } from "@/lib/voice";

const OFF: VoiceState = { available: false };

// Who is in voice channels right now, from the server's public widget (Server Settings → Widget).
// It needs no token but only works when enabled. Disabled, not configured, or Discord down:
// answer "unavailable" and the home page badge simply stays hidden.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.isMember) return NextResponse.json(OFF, { status: 401 });

  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId || !/^\d+$/.test(guildId)) return NextResponse.json(OFF);

  try {
    // Cache for 30 s so eight open tabs don't each hit Discord separately.
    const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    // 403 (code 50004): widget disabled; 404: no such server.
    if (!res.ok) return NextResponse.json(OFF);
    return NextResponse.json(parseWidget(await res.json()));
  } catch {
    return NextResponse.json(OFF);
  }
}
