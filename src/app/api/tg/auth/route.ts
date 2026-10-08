import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isGroupMember, verifyInitData } from "@/lib/telegram";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/**
 * Вход из мини-приложения. Telegram подписал, кто открыл приложение;
 * пускаем только участников нашей группы и открываем сессию Supabase
 * (одноразовой ссылкой-входом, которую сервер сразу и подтверждает).
 */
export async function POST(request: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_ID) return fail("not-configured", 503);

  const { initData } = (await request.json().catch(() => ({}))) as { initData?: string };
  const tg = verifyInitData(initData ?? "");
  if (!tg) return fail("bad-signature", 401);

  // Только участники группы — и при первом входе, и при каждом следующем.
  if (!(await isGroupMember(tg.id))) return fail("not-in-group", 403);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("telegram_id", tg.id).maybeSingle();

  let userId = profile?.id as string | undefined;
  let email: string | undefined;
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data.user?.email ?? undefined;
  } else {
    // Первый вход: аккаунт на служебный адрес. Ник и фото — из Telegram, потом их можно поменять в профиле.
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
