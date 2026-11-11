"use server";

import { redirect } from "next/navigation";
import { serverClient } from "../../lib/supabase";
import { PILOT_SITE_URL } from "../../lib/config";

export async function googleLogin() {
  let url: string | undefined;
  try {
    const client = await serverClient(true);
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${PILOT_SITE_URL}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (!result.error) url = result.data.url ?? undefined;
  } catch { /* Configuration/network errors remain a closed gate. */ }
  if (!url) redirect("/login?error=unavailable");
  redirect(url);
}

export async function logout() {
  const client = await serverClient(true);
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/workspace?error=logout");
  redirect("/login");
}
