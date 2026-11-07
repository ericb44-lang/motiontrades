import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, MoreVertical, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConditionBadge, EmptyState, FigureImage } from "@/components/market/bits";
import { RequireCollector } from "@/components/market/RequireCollector";
import { market, useMarket } from "@/lib/marketplace/store";
import type { Listing, ListingStatus } from "@/lib/marketplace/types";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/my-listings")({
  head: () => ({
    meta: [
      { title: "My listings | MOTIONTRADES" },
      {
        name: "description",
        content: "Manage your action figure listings: edit, pause, resume or remove them.",
      },
      { property: "og:title", content: "My listings | MOTIONTRADES" },
      { property: "og:description", content: "Manage your action figure trade listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyListings,
});

const statusMeta: Record<
  ListingStatus,
  { label: string; variant: "success" | "muted" | "warning" | "info" }
> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "muted" },
  in_trade: { label: "In trade", variant: "warning" },
  traded: { label: "Traded", variant: "info" },
};

type Filter = "all" | ListingStatus;

function MyListings() {
  return (
    <RequireCollector body="Make a quick profile first, then you can list your figures.">
      {(me) => <MyListingsInner meId={me.id} />}
    </RequireCollector>
  );
}

function MyListingsInner({ meId }: { meId: string }) {
  const state = useMarket();
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<Listing | null>(null);
  const mine = state.listings.filter((l) => l.ownerId === meId);
  const shown = filter === "all" ? mine : mine.filter((l) => l.status === filter);
  const count = (s: ListingStatus) => mine.filter((l) => l.status === s).length;
  const views = mine.reduce((s, l) => s + l.views, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">My listings</h1>
        </div>
        <Button asChild variant="hero">
          <Link to="/listings/new">
            <Plus /> List a figure
          </Link>
        </Button>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border bg-border md:grid-cols-4">
        {[
          ["Active", count("active")],
          ["In trade", count("in_trade")],
          ["Traded", count("traded")],
          ["Total views", views.toLocaleString("en-US")],
        ].map(([l, v]) => (
          <div key={l} className="bg-card p-5">
            <dt className="text-xs font-medium text-muted-foreground">{l}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-8">
        <TabsList className="h-auto flex-wrap bg-surface">
          <TabsTrigger value="all">All ({mine.length})</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="in_trade">In trade</TabsTrigger>
          <TabsTrigger value="traded">Traded</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6 space-y-3">
        {shown.length === 0 &&
          (mine.length === 0 ? (
            <EmptyState
              title="You haven't listed anything yet."
              body="List a figure and the offers will start showing up."
              action={
                <Button asChild variant="hero">
                  <Link to="/listings/new">
                    <Plus /> List a figure
                  </Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Nothing in this filter"
              body="None of your listings have this status right now."
            />
          ))}
        {shown.map((l) => {
          const editable = l.status === "active" || l.status === "paused";
          return (
            <div key={l.id} className="flex items-center gap-4 border bg-card p-3 sm:p-4">
              <Link
                to="/listings/$id"
                params={{ id: l.id }}
                className="size-16 shrink-0 overflow-hidden bg-surface sm:size-20"
              >
                <FigureImage src={l.images[0]} alt={l.title} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/listings/$id"
                  params={{ id: l.id }}
                  className="block truncate font-display text-sm font-bold hover:text-primary-glow"
                >
                  {l.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {l.brand} · {l.line} · Listed {formatDate(l.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusMeta[l.status].variant}>{statusMeta[l.status].label}</Badge>
                  <ConditionBadge condition={l.condition} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="size-3" /> {l.views}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Listing actions">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild disabled={!editable}>
                    <Link to="/listings/$id/edit" params={{ id: l.id }}>
                      <Pencil /> Edit
                    </Link>
                  </DropdownMenuItem>
                  {l.status === "active" && (
                    <DropdownMenuItem
                      onSelect={() => {
                        market.setListingStatus(l.id, "paused");
                        toast("Listing paused");
                      }}
                    >
                      <Pause /> Pause
                    </DropdownMenuItem>
                  )}
                  {l.status === "paused" && (
                    <DropdownMenuItem
                      onSelect={() => {
                        market.setListingStatus(l.id, "active");
                        toast.success("Listing is live again");
                      }}
                    >
                      <Play /> Resume
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!editable}
                    onSelect={() => setToDelete(l)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” will be removed from the marketplace. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) market.deleteListing(toDelete.id);
                toast("Listing deleted");
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
