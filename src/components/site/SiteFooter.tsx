import { Link } from "@tanstack/react-router";
import { Logo } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A place to trade action figures with other collectors, without the worry. Started by a
            collector who got burned once and didn't want it happening to anyone else.
          </p>
          <p className="mt-4 max-w-sm text-xs text-muted-foreground/80">
            Your email stays private. We'll never ask for your address, phone number or payment
            info.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold">Marketplace</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/browse" className="hover:text-foreground">
                Browse figures
              </Link>
            </li>
            <li>
              <Link to="/listings/new" className="hover:text-foreground">
                List a figure
              </Link>
            </li>
            <li>
              <Link to="/my-listings" className="hover:text-foreground">
                My Listings
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold">Trading</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/trades" className="hover:text-foreground">
                My Trades
              </Link>
            </li>
            <li>
              <Link to="/safety" className="hover:text-foreground">
                How trade safety works
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-foreground">
                About me
              </Link>
            </li>
            <li>
              <a
                href="https://www.tiktok.com/@mass_motion"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                TikTok
              </a>
            </li>
            <li>
              <a
                href="https://www.youtube.com/@Mass_motion/shorts"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                YouTube
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs font-medium text-muted-foreground sm:px-6">
          © 2026 MOTIONTRADES
        </p>
      </div>
    </footer>
  );
}
