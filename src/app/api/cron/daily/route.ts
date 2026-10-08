import { NextResponse, type NextRequest } from "next/server";
import { syncDiscord } from "@/lib/discord";
import { syncAllSteam } from "@/lib/steamApi";
import { createAdminClient } from "@/lib/supabase/admin";

// Раз в сутки (08:00 по Москве, см. vercel.json):
// 1) незаметно трогаем базу — бесплатный Supabase засыпает после 7 дней без запросов;
// 2) публикуем свежую сводку дня в Discord, если вебхук настроен;
// 3) обновляем, кто во что играл в Steam.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { count, error } = await createAdminClient().from("members").select("*", { count: "exact", head: true });
  if (error) console.error("Keep-alive query failed", error);

  await syncDiscord();
  const steam = await syncAllSteam();
  return NextResponse.json({ ok: !error, members: count ?? 0, steam });
}
