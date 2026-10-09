import { NextResponse, type NextRequest } from "next/server";
import { syncDiscord } from "@/lib/discord";
import { syncAllSteam } from "@/lib/steamApi";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupMemberStatus } from "@/lib/telegram";

// Раз в сутки (08:00 по Москве, см. vercel.json):
// 1) незаметно трогаем базу — бесплатный Supabase засыпает после 7 дней без запросов;
// 2) убираем из участников тех, кто вышел из группы в Telegram;
// 3) публикуем свежую сводку дня в Discord, если вебхук настроен;
// 4) обновляем, кто во что играл в Steam.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createAdminClient();
  const { count, error } = await db.from("members").select("*", { count: "exact", head: true });
  if (error) console.error("Keep-alive query failed", error);

  const left = await removeLeftMembers(db);
  await syncDiscord();
  const steam = await syncAllSteam();
  return NextResponse.json({ ok: !error, members: count ?? 0, left, steam });
}

/**
 * Доступ дают за членство в группе, но проверяется оно только при входе, а сессии живут долго.
 * Достаточно убрать строку из members: RLS спрячет данные, а вход заново проверит группу.
 * Выгоняем только по точному ответу Telegram «вышел/исключён», при любой неясности — никого.
 */
async function removeLeftMembers(db: ReturnType<typeof createAdminClient>) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_ID) return { skipped: "no-bot" };

  const { data, error } = await db.from("members").select("user_id, profiles!members_user_id_fkey(telegram_id)");
  if (error) {
    console.error("Members query failed", error);
    return { skipped: "query-failed" };
  }
  const rows = (data ?? []).map((r) => ({
    userId: r.user_id as string,
    telegramId: (r.profiles as unknown as { telegram_id: number | null } | null)?.telegram_id ?? null,
  }));

  // По одному: группа маленькая, а Telegram не любит пачки запросов.
  const gone: string[] = [];
  let unknown = 0;
  for (const r of rows) {
    if (!r.telegramId) continue;
    const status = await groupMemberStatus(r.telegramId);
    if (status === "gone") gone.push(r.userId);
    else if (status === "unknown") unknown++;
  }

  const result = { total: rows.length, unknown, gone: gone.length, removed: 0 };
  if (!gone.length) return result;
  // Если «ушла» больше половины — скорее всего, не та группа в настройках. Никого не трогаем.
  if (gone.length * 2 > rows.length) {
    console.error(`Group check: ${gone.length} of ${rows.length} members look gone — check TELEGRAM_GROUP_ID, nobody removed`);
    return result;
  }

  const { error: deleteError, count: removed } = await db.from("members").delete({ count: "exact" }).in("user_id", gone);
  if (deleteError) console.error("Removing left members failed", deleteError);
  return { ...result, removed: removed ?? 0 };
}
