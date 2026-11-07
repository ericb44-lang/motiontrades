import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { market, useMarket, useMe } from "@/lib/marketplace/store";
import { getNextAction } from "@/lib/marketplace/trade-logic";
import { CollectorAvatar } from "@/components/market/bits";
import { toast } from "sonner";

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="MOTIONTRADES home">
      {/* The uploaded logo is shown exactly as provided — only scaled, never recolored or redrawn. */}
      <img
        src="/brand/motiontrades-logo.png"
        alt="MOTIONTRADES"
        width={535}
        height={48}
        className="h-[18px] w-auto sm:h-6"
      />
    </Link>
  );
}

const nav = [
  { to: "/browse", label: "Browse" },
  { to: "/trades", label: "My Trades" },
  { to: "/my-listings", label: "My Listings" },
  { to: "/safety", label: "Trade Safety" },
  { to: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const state = useMarket();
  const me = useMe();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const actionCount = state.trades.filter((t) =>
    me ? getNextAction(t, me.id, state.reports).actor === "you" : false,
  ).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/browse", search: { q: q.trim() || undefined } });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="relative px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className:
                  "text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-primary",
              }}
            >
              {n.label}
              {n.to === "/trades" && actionCount > 0 && (
                <span className="ml-1.5 inline-grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                  {actionCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Pushes the right-hand controls to the edge when the search box is hidden. */}
        <div className="flex-1 md:hidden" />

        <form onSubmit={submit} className="relative ml-auto hidden max-w-xs flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search figures, lines, brands"
            className="h-9 bg-surface pl-9"
            aria-label="Search listings"
          />
        </form>

        <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex">
          <Link to="/listings/new">
            <Plus /> List a figure
          </Link>
        </Button>

        {!me && (
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/join">
              <UserPlus /> Join
            </Link>
          </Button>
        )}

        {me && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
              aria-label="Account menu"
            >
              <CollectorAvatar collector={me} size="sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-semibold">{me.displayName}</p>
                <p className="text-xs font-normal text-muted-foreground">@{me.username}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/collectors/$username" params={{ username: me.username }}>
                  My profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/trades">My Trades</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-listings">My Listings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  market.signOut();
                  toast("Signed out");
                }}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  if (
                    !window.confirm(
                      "Delete every profile, listing and trade saved in this browser?",
                    )
                  )
                    return;
                  market.clearLocalData();
                  toast.success("All saved data cleared");
                }}
              >
                <Trash2 /> Clear data in this browser
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-background">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <form onSubmit={submit} className="relative mt-6 px-4">
              <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search figures"
                className="bg-surface pl-9"
              />
            </form>
            <nav className="mt-4 flex flex-col px-2">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b px-2 py-4 font-display text-sm font-bold"
                  activeProps={{ className: "text-primary-glow" }}
                >
                  {n.label}
                  {n.to === "/trades" && actionCount > 0 && (
                    <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                      {actionCount}
                    </span>
                  )}
                </Link>
              ))}
              {me ? (
                <Link
                  to="/collectors/$username"
                  params={{ username: me.username }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b px-2 py-4"
                >
                  <CollectorAvatar collector={me} size="sm" />
                  <span className="text-sm font-semibold">My profile</span>
                </Link>
              ) : (
                <Link
                  to="/join"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b px-2 py-4 font-display text-sm font-bold"
                >
                  <UserPlus className="size-4 text-primary" /> Join / sign in
                </Link>
              )}
            </nav>
            <div className="mt-6 px-4">
              <Button asChild variant="hero" className="w-full">
                <Link to="/listings/new" onClick={() => setOpen(false)}>
                  <Plus /> List a figure
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
