import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollectorAvatar } from "@/components/market/bits";
import { market, useMarket, useMarketHydrated } from "@/lib/marketplace/store";
import { validateCollectorProfile, validateEmail } from "@/lib/marketplace/trade-logic";

interface JoinSearch {
  redirect?: string | undefined;
}

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): JoinSearch => ({
    // Only allow in-app paths so the redirect can't send people off-site.
    redirect:
      typeof s["redirect"] === "string" &&
      s["redirect"].startsWith("/") &&
      !s["redirect"].startsWith("//")
        ? s["redirect"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Join | MOTIONTRADES" },
      {
        name: "description",
        content:
          "Create a collector profile to list action figures, make trade offers and build reputation.",
      },
      { property: "og:title", content: "Join | MOTIONTRADES" },
      {
        property: "og:description",
        content: "Start trading action figures collector to collector.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const state = useMarket();
  const hydrated = useMarketHydrated();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [bio, setBio] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [line, setLine] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"displayName" | "username" | "email", string>>
  >({});

  // redirect is validated above to be an in-app path.
  const go = () => router.history.push(redirect ?? "/");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<"displayName" | "username" | "email", string>> =
      validateCollectorProfile(
        { displayName, username },
        state.collectors.map((c) => c.username),
      );
    const emailError = validateEmail(
      email,
      state.collectors.flatMap((c) => (c.email ? [c.email] : [])),
    );
    if (emailError) errs.email = emailError;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      market.registerCollector({ displayName, username, email, region, bio, favoriteLines: lines });
      toast.success("You're in. Welcome to MOTIONTRADES!");
      go();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const addLine = () => {
    const t = line.trim().slice(0, 40);
    if (t && !lines.includes(t) && lines.length < 6) setLines([...lines, t]);
    setLine("");
  };

  const others = hydrated ? state.collectors.filter((c) => c.id !== state.currentUserId) : [];

  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Make your collector profile</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          This is what other collectors see: your figures, your reviews and your rep. Your email
          stays private, and we'll never ask for your address, phone number or payment info.
        </p>

        <form onSubmit={submit} noValidate className="mt-10 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="j-name">Display name</Label>
              <Input
                id="j-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="bg-surface"
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="j-user">Username</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="j-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  maxLength={20}
                  className="bg-surface pl-7"
                />
              </div>
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-email">Email</Label>
            <Input
              id="j-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="name@example.com"
              className="bg-surface"
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only used for trade updates. Nobody else sees it.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-region">Region (optional)</Label>
            <Input
              id="j-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={40}
              placeholder="Like a state or country. Not your address."
              className="bg-surface"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-bio">About you (optional)</Label>
            <Textarea
              id="j-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="What do you collect?"
              className="bg-surface"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-line">Favorite lines (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="j-line"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLine();
                  }
                }}
                maxLength={40}
                className="bg-surface"
              />
              <Button type="button" variant="outline" onClick={addLine} aria-label="Add line">
                <Plus />
              </Button>
            </div>
            {lines.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {lines.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 border bg-card px-2 py-0.5 text-xs"
                  >
                    {l}
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((x) => x !== l))}
                      aria-label={`Remove ${l}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" variant="hero" size="lg">
            Create profile <ArrowRight />
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="clip-chamfer border bg-surface p-5">
          <p className="eyebrow mb-3">Already have a profile?</p>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Profiles you create in this browser will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {others.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      market.signIn(c.id);
                      toast.success(`Signed in as ${c.displayName}`);
                      go();
                    }}
                    className="flex w-full items-center gap-3 border bg-card p-3 text-left transition-colors hover:border-primary"
                  >
                    <CollectorAvatar collector={c} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{c.username}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Profiles are stored in this browser for now.{" "}
          <Link to="/safety" className="underline-offset-4 hover:underline">
            How trade safety works
          </Link>
        </p>
      </aside>
    </div>
  );
}
