import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { EMPTY_LISTING, ListingForm } from "@/components/market/ListingForm";
import { RequireCollector } from "@/components/market/RequireCollector";
import { market } from "@/lib/marketplace/store";

export const Route = createFileRoute("/listings/new")({
  head: () => ({
    meta: [
      { title: "List a figure | MOTIONTRADES" },
      {
        name: "description",
        content:
          "Create a trade listing with photos, condition notes and every included accessory.",
      },
      { property: "og:title", content: "List a figure | MOTIONTRADES" },
      {
        property: "og:description",
        content: "Create an action figure trade listing on MOTIONTRADES.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewListing,
});

function NewListing() {
  const navigate = useNavigate();
  return (
    <RequireCollector body="Make a quick profile first so people know who they're trading with.">
      {() => (
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-extrabold sm:text-4xl">List a figure</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Be honest and detailed. Whatever you put here goes into the agreement if someone trades
            with you.
          </p>
          <div className="mt-10">
            <ListingForm
              initial={EMPTY_LISTING}
              submitLabel="Publish listing"
              onSubmit={async (v) => {
                try {
                  const id = await market.createListing(v);
                  toast.success("Listing published");
                  void navigate({ to: "/listings/$id", params: { id } });
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </div>
        </div>
      )}
    </RequireCollector>
  );
}
