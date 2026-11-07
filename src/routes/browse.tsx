import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ListingCard } from "@/components/market/ListingCard";
import { EmptyState } from "@/components/market/bits";
import { findCollector, useMarket } from "@/lib/marketplace/store";
import {
  CATEGORIES,
  CONDITIONS,
  SCALES,
  type Category,
  type Condition,
  type Scale,
} from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";
import { Advertisement } from "@/components/site/Advertising";

type Sort = "newest" | "popular" | "condition";

interface BrowseSearch {
  q?: string | undefined;
  category?: Category | undefined;
  condition?: Condition | undefined;
  scale?: Scale | undefined;
  sort?: Sort | undefined;
}

const pick = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

export const Route = createFileRoute("/browse")({
  validateSearch: (s: Record<string, unknown>): BrowseSearch => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: pick(s["category"], CATEGORIES),
    condition: pick(s["condition"], CONDITIONS),
    scale: pick(s["scale"], SCALES),
    sort: pick(s["sort"], ["newest", "popular", "condition"] as const),
  }),
  head: () => ({
    meta: [
      { title: "Browse figures | MOTIONTRADES" },
      {
        name: "description",
        content: "Search action figure listings by line, brand, condition, scale and category.",
      },
      { property: "og:title", content: "Browse figures | MOTIONTRADES" },
      {
        property: "og:description",
        content: "Search trade listings from collectors by condition, scale and category.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Browse,
});

function Browse() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const state = useMarket();
  const [q, setQ] = useState(search.q ?? "");

  const set = (patch: Partial<BrowseSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const results = useMemo(() => {
    const needle = (search.q ?? "").toLowerCase();
    const list = state.listings.filter((l) => {
      if (l.status !== "active") return false;
      if (search.category && l.category !== search.category) return false;
      if (search.condition && l.condition !== search.condition) return false;
      if (search.scale && l.scale !== search.scale) return false;
      if (needle) {
        const hay = [l.title, l.line, l.brand, l.description, ...l.accessories]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sort = search.sort ?? "newest";
    return list.sort((a, b) => {
      if (sort === "popular") return b.views - a.views;
      if (sort === "condition")
        return CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [state.listings, search]);

  const activeFilters = [search.category, search.condition, search.scale].filter(Boolean).length;

  const filters = (
    <div className="space-y-8">
      <FilterGroup
        label="Category"
        options={CATEGORIES}
        value={search.category}
        onChange={(v) => set({ category: v as Category | undefined })}
      />
      <FilterGroup
        label="Condition"
        options={CONDITIONS}
        value={search.condition}
        onChange={(v) => set({ condition: v as Condition | undefined })}
      />
      <FilterGroup
        label="Scale"
        options={SCALES}
        value={search.scale}
        onChange={(v) => set({ scale: v as Scale | undefined })}
      />
      {activeFilters > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set({ category: undefined, condition: undefined, scale: undefined })}
        >
          <X /> Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Browse figures</h1>

      <Advertisement placement="browse-top" className="mt-6" />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim() || undefined });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by figure, line, brand or accessory"
            className="h-11 bg-surface pl-9"
            aria-label="Search listings"
          />
        </form>
        <div className="flex gap-3">
          <Select value={search.sort ?? "newest"} onValueChange={(v) => set({ sort: v as Sort })}>
            <SelectTrigger className="h-11 w-full bg-surface sm:w-44" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most viewed</SelectItem>
              <SelectItem value="condition">Best condition</SelectItem>
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 lg:hidden">
                <SlidersHorizontal /> Filters{activeFilters ? ` (${activeFilters})` : ""}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto bg-background">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">{filters}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "listing" : "listings"}
            {search.q ? ` for “${search.q}”` : ""}
          </p>
          {results.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {results.map((l) => (
                <ListingCard key={l.id} listing={l} owner={findCollector(state, l.ownerId)} />
              ))}
            </div>
          ) : state.listings.some((l) => l.status === "active") ? (
            <EmptyState
              title="Nothing matches that"
              body="Try a different search or clear a filter."
            />
          ) : (
            <EmptyState
              title="Nothing listed yet."
              body="We just opened. List something and you'll be the first figure people see."
              action={
                <Button asChild variant="hero">
                  <Link to="/listings/new">
                    <Plus /> List a figure
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(value === o ? undefined : o)}
            className={cn(
              "border px-3 py-1.5 text-left text-sm transition-colors",
              value === o
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
            aria-pressed={value === o}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
