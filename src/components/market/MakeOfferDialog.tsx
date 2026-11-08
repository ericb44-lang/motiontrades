import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Repeat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { market, useMarket } from "@/lib/marketplace/store";
import type { Listing } from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";
import { ConditionBadge, FigureImage } from "./bits";

export function MakeOfferDialog({
  listing,
  children,
}: {
  listing: Listing;
  children: React.ReactNode;
}) {
  const state = useMarket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = state.listings.filter(
    (l) => !!state.currentUserId && l.ownerId === state.currentUserId && l.status === "active",
  );
  const theirs = state.listings.filter(
    (l) => l.ownerId === listing.ownerId && l.status === "active",
  );
  const [offered, setOffered] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([listing.id]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async () => {
    setSending(true);
    try {
      const id = await market.proposeTrade({
        receiverId: listing.ownerId,
        offeredListingIds: offered,
        requestedListingIds: requested,
        message: message.trim(),
      });
      toast.success("Trade offer sent");
      setOpen(false);
      void navigate({ to: "/trades/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!state.currentUserId) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Log in to make an offer</DialogTitle>
            <DialogDescription>
              Log in or make a free account first. It only takes a minute, and we never ask for your
              address.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button asChild variant="outline">
              <Link to="/join" search={{ redirect: `/listings/${listing.id}` }}>
                Join
              </Link>
            </Button>
            <Button asChild variant="hero">
              <Link to="/login" search={{ redirect: `/listings/${listing.id}` }}>
                Log in
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Propose a trade</DialogTitle>
          <DialogDescription>
            Pick what you'll send and what you'd like back. Once accepted, both sides get a written
            agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
          <PickList
            title="You send"
            items={mine}
            selected={offered}
            onToggle={(id) => toggle(offered, setOffered, id)}
            empty={
              <p className="text-sm text-muted-foreground">
                You have no active listings.{" "}
                <Link to="/listings/new" className="text-primary-glow underline">
                  List a figure
                </Link>{" "}
                first.
              </p>
            }
          />
          <div className="hidden items-center md:flex">
            <Repeat className="size-5 text-primary" />
          </div>
          <PickList
            title="You receive"
            items={theirs}
            selected={requested}
            onToggle={(id) => toggle(requested, setRequested, id)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="offer-msg">Message (optional)</Label>
          <Textarea
            id="offer-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            placeholder="Say hello, mention extra photos, or explain your offer."
            className="bg-surface"
          />
          <p className="text-xs text-muted-foreground">
            Don't share your address or payment info. You'll never need to here.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="hero"
            onClick={() => void submit()}
            disabled={sending || !offered.length || !requested.length}
          >
            Send offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickList({
  title,
  items,
  selected,
  onToggle,
  empty,
}: {
  title: string;
  items: Listing[];
  selected: string[];
  onToggle: (id: string) => void;
  empty?: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">
        {title} · {selected.length}
      </p>
      {items.length === 0 && empty}
      <ul className="space-y-2">
        {items.map((l) => {
          const on = selected.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onToggle(l.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 border p-2 text-left transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                )}
              >
                <div className="size-12 shrink-0 overflow-hidden bg-surface">
                  <FigureImage src={l.images[0]} alt="" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <ConditionBadge condition={l.condition} className="mt-1" />
                </div>
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
