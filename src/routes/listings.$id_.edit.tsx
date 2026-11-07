import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/market/bits";
import { ListingForm } from "@/components/market/ListingForm";
import { market, useMarket, useMarketHydrated } from "@/lib/marketplace/store";

export const Route = createFileRoute("/listings/$id_/edit")({
  head: () => ({
    meta: [
      { title: "Edit listing | MOTIONTRADES" },
      {
        name: "description",
        content: "Update photos, condition notes and accessories for your listing.",
      },
      { property: "og:title", content: "Edit listing | MOTIONTRADES" },
      { property: "og:description", content: "Update your action figure trade listing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditListing,
});

function EditListing() {
  const { id } = Route.useParams();
  const state = useMarket();
  const hydrated = useMarketHydrated();
  const navigate = useNavigate();
  const listing = state.listings.find((l) => l.id === id);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!listing || !state.currentUserId || listing.ownerId !== state.currentUserId) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <EmptyState
          title="You can't edit this listing"
          body="Only the collector who created a listing can edit it."
          action={
            <Button asChild variant="outline">
              <Link to="/my-listings">Go to My Listings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const locked = listing.status === "in_trade" || listing.status === "traded";
  const { id: _id, ownerId: _o, createdAt: _c, views: _v, status: _s, ...initial } = listing;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow mb-2">Edit listing</p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">{listing.title}</h1>
      {locked ? (
        <div className="mt-8">
          <EmptyState
            title="This figure is part of a trade"
            body="Listings locked into a trade agreement can't be edited, so the written terms stay accurate."
            action={
              <Button asChild variant="outline">
                <Link to="/trades">View My Trades</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-10">
          <ListingForm
            initial={initial}
            submitLabel="Save changes"
            onSubmit={(v) => {
              market.updateListing(id, v);
              toast.success("Listing updated");
              navigate({ to: "/listings/$id", params: { id } });
            }}
          />
        </div>
      )}
    </div>
  );
}
