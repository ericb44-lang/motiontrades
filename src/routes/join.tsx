import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Loader2, MailCheck, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MIN_PASSWORD_LENGTH, market, useMe } from "@/lib/marketplace/store";
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
  const me = useMe();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [bio, setBio] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [line, setLine] = useState("");
  type Field = "displayName" | "username" | "email" | "password";
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  // redirect is validated above to be an in-app path.
  const go = () => router.history.push(redirect ?? "/");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<Field, string>> = validateCollectorProfile(
      { displayName, username },
      [],
    );
    const emailError = validateEmail(email, []);
    if (emailError) errs.email = emailError;
    if (password.length < MIN_PASSWORD_LENGTH)
      errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await market.registerCollector({
        displayName,
        username,
        email,
        password,
        region,
        bio,
        favoriteLines: lines,
      });
      if (needsConfirmation) {
        setSentTo(email.trim().toLowerCase());
      } else {
        toast.success("You're in. Welcome to MOTIONTRADES!");
        go();
      }
    } catch (err) {
      const message = (err as Error).message;
      if (/username/i.test(message)) setErrors({ username: message });
      else if (/email/i.test(message)) setErrors({ email: message });
      else toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-6 text-3xl font-extrabold">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a link to <span className="font-semibold text-foreground">{sentTo}</span>. Click
          it to confirm your account, then you can start trading.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing there after a few minutes? Check spam, or{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() =>
              void market.resendConfirmation(sentTo).then(
                () => toast.success("Sent it again"),
                (e: Error) => toast.error(e.message),
              )
            }
          >
            send it again
          </button>
          .
        </p>
      </div>
    );
  }

  if (me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-extrabold">You're logged in as @{me.username}</h1>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="hero" onClick={go}>
            Keep going <ArrowRight />
          </Button>
          <Button variant="outline" onClick={() => void market.signOut()}>
            Log out
          </Button>
        </div>
      </div>
    );
  }

  const addLine = () => {
    const t = line.trim().slice(0, 40);
    if (t && !lines.includes(t) && lines.length < 6) setLines([...lines, t]);
    setLine("");
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Make your collector profile</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          This is what other collectors see: your figures, your reviews and your rep. Your email
          stays private. We only ask for your address when you buy a shipping label for a trade.
        </p>

        <form onSubmit={(e) => void submit(e)} noValidate className="mt-10 space-y-6">
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
            <Label htmlFor="j-pass">Password</Label>
            <Input
              id="j-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              className="bg-surface"
            />
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
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
          <Button type="submit" variant="hero" size="lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} Create account <ArrowRight />
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="clip-chamfer border bg-surface p-5">
          <p className="font-bold">Already have an account?</p>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/login" search={redirect ? { redirect } : {}}>
              Log in
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link to="/safety" className="underline-offset-4 hover:underline">
            How trade safety works
          </Link>
        </p>
      </aside>
    </div>
  );
}
