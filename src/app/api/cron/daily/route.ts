import { NextResponse, type NextRequest } from "next/server";
import { syncDiscord } from "@/lib/discord";
import { syncAllSteam } from "@/lib/steamApi";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupMemberStatus } from "@/lib/telegram";

// Once a day (08:00 Moscow time, see vercel.json):
// 1) quietly touch the database: free Supabase projects pause after 7 days without requests;
// 2) remove members who left the Telegram group;
// 3) post a fresh daily summary to Discord if the webhook is configured;
// 4) refresh who played what on Steam.
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
 * Access is granted by group membership, but it is only checked at login and sessions live long.
 * Removing the members row is enough: RLS hides the data and the next login re-checks the group.
 * Only remove on Telegram's explicit "left/kicked" answer; when in doubt, remove nobody.
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

  // One at a time: the group is small and Telegram dislikes bursts.
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
  // If more than half look gone, the group in the settings is most likely wrong. Remove nobody.
  if (gone.length * 2 > rows.length) {
    console.error(`Group check: ${gone.length} of ${rows.length} members look gone — check TELEGRAM_GROUP_ID, nobody removed`);
    return result;
  }

  const { error: deleteError, count: removed } = await db.from("members").delete({ count: "exact" }).in("user_id", gone);
  if (deleteError) console.error("Removing left members failed", deleteError);
  return { ...result, removed: removed ?? 0 };
}
