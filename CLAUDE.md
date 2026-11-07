# Project rules

- Marketplace data currently lives in a client-side store (`src/lib/marketplace/store.ts`, persisted to localStorage) and every mutation goes through `market.*`. Moving to Supabase means reimplementing those actions as server functions; pages should not change.
- Trade rules (phases, next action, shipping/inspection transitions, reputation) are pure functions in `src/lib/marketplace/trade-logic.ts` with unit tests. Keep UI and storage out of them so the server can reuse them.
- Pages render the empty marketplace during SSR and switch to browser-saved data after hydration (`useMarketHydrated`). Never read localStorage during render, to avoid hydration mismatches.
- The app ships with zero sample content (`createEmptyState`). Fictional data exists only as a test fixture in `src/test/fixtures` and must never be imported by app code.
- Actions that need an account go through `RequireCollector` (pages) or check `currentUserId` (dialogs); `market.*` throws when no collector profile is signed in.
- Dates are formatted in UTC via `src/lib/format.ts` so server and browser output match.
- Never add fields that collect real mailing addresses, phone numbers, payment or carrier details. The sign-up email is the one contact detail collected; it is private and never rendered on public pages.
- Every UI library the app imports is listed in `optimizeDeps.include` in `vite.config.ts`; otherwise dev mode can re-bundle mid-session and load two copies of React (blank screen). Add new libraries there too.
- Advertising is presentation-only and controlled in `src/lib/advertising.ts`. Render the shared placements only on their exact public-page allowlist, never in shared layouts, so sensitive workflows stay ad-free. Future provider adapters belong inside `Advertisement`, not individual pages.
- Secrets (Supabase service key, etc.) go in environment variables on the host, never in the repo. Only `VITE_`-prefixed variables reach the browser, so never prefix a secret with `VITE_`.
- Before finishing a change: `npm run typecheck`, `npm test`, `npm run build`.
