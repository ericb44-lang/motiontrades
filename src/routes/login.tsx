import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { market, useMe } from "@/lib/marketplace/store";

interface LoginSearch {
  redirect?: string | undefined;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    // Only in-app paths, so the link can't send people to another site.
    redirect:
      typeof s["redirect"] === "string" &&
      s["redirect"].startsWith("/") &&
      !s["redirect"].startsWith("//")
        ? s["redirect"]
        : undefined,
  }),
  head: () => ({
    meta: [{ title: "Log in | MOTIONTRADES" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const me = useMe();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const go = () => router.history.push(redirect ?? "/");

  const logIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await market.logIn(email, password);
      toast.success("Welcome back!");
      go();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await market.requestPasswordReset(email);
      setResetSentTo(email.trim().toLowerCase());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (me && !busy) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-extrabold">You're logged in as @{me.username}</h1>
        <Button variant="hero" className="mt-6" onClick={go}>
          Keep going <ArrowRight />
        </Button>
      </div>
    );
  }

  if (resetSentTo) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-6 text-3xl font-extrabold">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          If there's an account for{" "}
          <span className="font-semibold text-foreground">{resetSentTo}</span>, we sent it a link to
          pick a new password.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold">
        {mode === "login" ? "Log in" : "Reset your password"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "login"
          ? "Good to see you again."
          : "Enter the email you signed up with and we'll send you a link."}
      </p>

      <form
        onSubmit={(e) => void (mode === "login" ? logIn(e) : sendReset(e))}
        className="mt-8 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="l-email">Email</Label>
          <Input
            id="l-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface"
            required
          />
        </div>
        {mode === "login" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="l-pass">Password</Label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="l-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface"
              required
            />
          </div>
        )}
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {mode === "login" ? "Log in" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              to="/join"
              search={redirect ? { redirect } : {}}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Make an account
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Back to log in
          </button>
        )}
      </p>
    </div>
  );
}
