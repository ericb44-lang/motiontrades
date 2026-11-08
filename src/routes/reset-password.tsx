import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MIN_PASSWORD_LENGTH, market, useMarketHydrated, useMe } from "@/lib/marketplace/store";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Pick a new password | MOTIONTRADES" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

/** Where the "reset your password" email link lands. The link logs the person in first. */
function ResetPasswordPage() {
  const router = useRouter();
  const hydrated = useMarketHydrated();
  const me = useMe();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-extrabold">That link didn't work</h1>
        <p className="mt-3 text-muted-foreground">
          Reset links expire after a while and only work once. Ask for a fresh one and open it on
          this device.
        </p>
        <Button asChild variant="hero" className="mt-6">
          <Link to="/login">Get a new link</Link>
        </Button>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Those passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await market.updatePassword(password);
      toast.success("Password updated");
      router.history.push("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <KeyRound className="size-8 text-primary" />
      <h1 className="mt-4 text-3xl font-extrabold">Pick a new password</h1>
      <p className="mt-2 text-muted-foreground">For @{me.username}.</p>
      <form onSubmit={(e) => void save(e)} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="r-pass">New password</Label>
          <Input
            id="r-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface"
          />
          <p className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-confirm">Type it again</Label>
          <Input
            id="r-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null} Save new password
        </Button>
      </form>
    </div>
  );
}
