// Browser connection to the MOTIONTRADES Supabase project.
// The URL and publishable key are public by design (row-level security protects the data),
// so defaults live here. Override with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL: string =
  import.meta.env["VITE_SUPABASE_URL"] ?? "https://otzzjofrqoimmxvsdife.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  "sb_publishable_L8rWoQBBjhMQl_YpMj9plQ_APyLr7Bq";

export const PHOTO_BUCKET = "listing-photos";

let client: SupabaseClient | null = null;

/** The shared client. Browser only: never call during server rendering. */
export function supabase(): SupabaseClient {
  if (typeof window === "undefined") throw new Error("Supabase is only available in the browser");
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Public URL for a photo stored in the listing-photos bucket. */
export const photoUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

/**
 * Where email links (confirm sign-up, reset password) should send people back to.
 * Works both on the real site (/path routes) and the GitHub Pages preview (#/path routes).
 */
export function appUrl(route: string): string {
  const { origin, pathname, hash } = window.location;
  const usesHashRoutes = hash.startsWith("#/") || pathname.endsWith(".html");
  if (usesHashRoutes || import.meta.env["VITE_HASH_ROUTES"] === "true") {
    return `${origin}${pathname}#${route}`;
  }
  return `${origin}${route}`;
}
