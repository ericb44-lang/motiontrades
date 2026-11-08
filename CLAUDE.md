# Project rules

- Data lives in Supabase (project `otzzjofrqoimmxvsdife`). Pages read through `useMarket()` and change data only through `market.*` in `src/lib/marketplace/store.ts`.
- Listings, photos and profile edits go straight to the database; row-level security (see `supabase/migrations/`) decides who may do what. Every trade, review and report write goes through the `trade-action` edge function (`supabase/functions/trade-action`). Never add client-side writes to `trades`, `reviews` or `reports`.
- Schema changes: add a new file in `supabase/migrations/` (never edit an applied one), apply it, re-run the RLS checks, and check Supabase's security advisors.
- Trade rules are pure functions in `src/lib/marketplace/trade-logic.ts`; who-may-do-what checks are in `trade-actions.ts`. Both have unit tests and run inside the edge function. After changing `types.ts`, `trade-logic.ts`, `trade-actions.ts` or `rows.ts`, run `npm run sync:edge` and redeploy `trade-action` (a test fails if the copies drift).
- Pages render the empty marketplace during SSR and switch to live data after hydration (`useMarketHydrated`). The Supabase client is browser-only (`supabase()` throws on the server).
- The app ships with zero sample content. Fictional data exists only as a test fixture in `src/test/fixtures` and must never be imported by app code.
- Actions that need an account go through `RequireCollector` (pages) or check `currentUserId` (dialogs); `market.*` throws when nobody is logged in.
- Listing photos are paths in the public `listing-photos` bucket ("<user id>/<uuid>.jpg"), shown through `resolveImage()`. Max 10 per listing (database enforced).
- Dates are formatted in UTC via `src/lib/format.ts` so server and browser output match.
- Never add fields that collect real mailing addresses, phone numbers, payment or carrier details (until the shipping-label decision is made). The sign-up email lives only in Supabase Auth and is never rendered on public pages.
- Every UI library the app imports is listed in `optimizeDeps.include` in `vite.config.ts`; otherwise dev mode can re-bundle mid-session and load two copies of React (blank screen). Add new libraries there too.
- Advertising is presentation-only and controlled in `src/lib/advertising.ts`. Render the shared placements only on their exact public-page allowlist, never in shared layouts, so sensitive workflows stay ad-free. Future provider adapters belong inside `Advertisement`, not individual pages.
- Secrets (Supabase service key, etc.) go in environment variables on the host, never in the repo. Only `VITE_`-prefixed variables reach the browser, so never prefix a secret with `VITE_`.
- Before finishing a change: `npm run typecheck`, `npm test`, `npm run build`.
