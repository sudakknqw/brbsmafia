import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isGroupMember, verifyInitData } from "@/lib/telegram";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/**
 * Login from the Mini App. Telegram signs who opened the app;
 * we only let in members of our group and open a Supabase session
 * (via a one-time magic link that the server verifies right away).
 */
export async function POST(request: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_ID) return fail("not-configured", 503);

  const { initData } = (await request.json().catch(() => ({}))) as { initData?: string };
  const tg = verifyInitData(initData ?? "");
  if (!tg) return fail("bad-signature", 401);

  // Group members only, on the first login and on every later one.
  if (!(await isGroupMember(tg.id))) return fail("not-in-group", 403);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("telegram_id", tg.id).maybeSingle();

  let userId = profile?.id as string | undefined;
  let email: string | undefined;
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data.user?.email ?? undefined;
  } else {
    // First login: an account on a service email. Name and photo come from Telegram and can be changed in the profile.
    email = `tg${tg.id}@telegram.brbsmafia.app`;
    const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || tg.username || "Без имени";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name, avatar_url: tg.photo_url ?? null, telegram_id: tg.id },
    });
    if (error || !data.user) return fail("create-failed", 500);
    userId = data.user.id;
    await admin.from("profiles").update({ telegram_id: tg.id }).eq("id", userId);
  }
  if (!userId || !email) return fail("no-account", 500);

  await admin.from("members").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) return fail("session-failed", 500);
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (otpError) return fail("session-failed", 500);

  return NextResponse.json({ ok: true });
}
