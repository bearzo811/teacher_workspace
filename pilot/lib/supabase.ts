import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { pilotConfig, pilotCookieOptions } from "./config";

export async function serverClient(writable = false) {
  const { url, key } = pilotConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: pilotCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components cannot write cookies; middleware handles refresh.
        if (writable) for (const { name, value, options } of values) jar.set(name, value, options);
      },
    },
  });
}
