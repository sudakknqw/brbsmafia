import { NextResponse, type NextRequest } from "next/server";
import { syncDiscord } from "@/lib/discord";

// Раз в сутки: свежее сообщение в Discord на новый день.
// Заодно не даёт бесплатному Supabase уснуть.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await syncDiscord();
  return NextResponse.json({ ok: true });
}
