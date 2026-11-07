# MOTIONTRADES

A collector-to-collector marketplace for trading action figures, with written trade
agreements, two-way shipping checkpoints and inspection before a trade closes.

Built with TanStack Start (React + server rendering), TypeScript, Tailwind CSS and shadcn/ui.

> **Current state:** all marketplace data is stored in each visitor's own browser
> (localStorage). There are no real accounts or shared database yet; that is the next phase
> (Supabase). See "Roadmap" below.

## Run it on your computer

You need Node.js 22 or newer ([download](https://nodejs.org)).

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Commands

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Local development server with live reload            |
| `npm test`          | Runs the unit tests (trade rules, routing, ads)      |
| `npm run typecheck` | Checks the TypeScript                                |
| `npm run build`     | Builds the production server into `.output/`         |
| `npm start`         | Runs the production build (`PORT` sets the port)     |

## Single-file preview

`npm run build:preview` writes `preview/dist/index.html`: the whole app in one file you can
open in a browser or send to someone. It runs in the browser only (data saved on that device)
and uses `#/` links, e.g. `index.html#/browse`.

## Deploy (Railway)

1. Push this folder to a GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway detects Node automatically. If asked, set:
   - Build command: `npm run build`
   - Start command: `npm start`
4. Under **Settings → Networking**, generate a domain to test, then add your custom domain
   (for example `trade.yourdomain.com`). Railway shows a CNAME value to copy.

Any Node host works the same way (Render, Fly.io, a VPS): build, then `npm start`.

## Connect it to your Squarespace domain

Squarespace keeps hosting your main site; the app lives on a subdomain.

1. Squarespace → **Settings → Domains** → your domain → **DNS Settings**.
2. Under **Custom Records**, add:
   - Host: `trade` (or whatever subdomain you chose)
   - Type: `CNAME`
   - Data: the value Railway gave you
3. Wait for DNS to update (minutes to a few hours). Railway issues the SSL certificate on its own.
4. Add a "Trade" link or button on your Squarespace site pointing to `https://trade.yourdomain.com`.

## Logo

`public/brand/motiontrades-logo.svg` is a placeholder wordmark (the original PNG was stored on
Lovable's servers, not in the export). To use the original: save it as
`public/brand/motiontrades-logo.png` and change the `src` in
`src/components/site/SiteHeader.tsx` to `/brand/motiontrades-logo.png`.

## Project layout

```
src/
  routes/                 One file per page (file name = URL)
  components/market/      Listing cards, forms, offer and report dialogs
  components/trade/       Trade workflow panels
  components/site/        Header, footer, advertising slots
  components/ui/          shadcn/ui building blocks
  lib/marketplace/
    types.ts              Data model (mirrors the future database tables)
    trade-logic.ts        Trade rules as pure, tested functions
    store.ts              Browser data store — the one file to swap for a real backend
  lib/advertising.ts      Where ads may appear (allowlist)
public/                   Static files (favicon, logo, robots.txt)
```

## Roadmap

- [x] Move off Lovable; runs anywhere Node runs
- [ ] Supabase project: auth (sign-up / login) and tables for collectors, listings, trades,
      reviews, reports
- [ ] Row-level security: owners edit only their own listings; each side signs only its own
      part of a trade
- [ ] Photo uploads to Supabase Storage instead of browser storage
- [ ] Replace `store.ts` internals with server functions backed by Supabase
- [ ] Admin screen for handling problem reports
- [ ] Email notifications for offers and trade steps
- [ ] Deploy to Railway and connect the Squarespace subdomain
