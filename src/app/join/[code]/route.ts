import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// После входа по приглашению: добавляем человека в компанию.
export async function GET(request: NextRequest, ctx: RouteContext<"/join/[code]">) {
  const { code } = await ctx.params;
  const { origin } = request.nextUrl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/invite/${code}`);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("code, created_by, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/invite/${code}`);
  }

  await admin
    .from("members")
    .upsert({ user_id: user.id, invited_by: invite.created_by }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: profile } = await admin.from("profiles").select("onboarded").eq("id", user.id).single();
  return NextResponse.redirect(`${origin}${profile?.onboarded ? "/" : "/onboarding"}`);
}
