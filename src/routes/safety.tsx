import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSignature,
  Lock,
  PackageCheck,
  ScanSearch,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INSPECTION_WINDOW_HOURS,
  PACKING_CHECKLIST,
  SHIP_WINDOW_DAYS,
} from "@/lib/marketplace/trade-logic";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "How trades stay safe | MOTIONTRADES" },
      {
        name: "description",
        content:
          "Exactly what happens on every MOTIONTRADES trade, from the first offer to the final review.",
      },
      { property: "og:title", content: "How trades stay safe | MOTIONTRADES" },
      {
        property: "og:description",
        content: "Exactly what happens on every trade, from the first offer to the final review.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Safety,
});

const stages = [
  {
    icon: FileSignature,
    title: "Put the deal in writing",
    body: "Once an offer's accepted, both figures, every accessory and the real condition go into an agreement. You both sign it before anything ships.",
  },
  {
    icon: PackageCheck,
    title: "Pack it right",
    body: "Before you can make a label, you check off the basics: it's wrapped well, every accessory is in the box, and you took photos before sealing it.",
  },
  {
    icon: Lock,
    title: "Both drop off",
    body: `You each have ${SHIP_WINDOW_DAYS} days to drop your box off. Tracking doesn't start until both are in, so nobody's left shipping first and hoping.`,
  },
  {
    icon: Truck,
    title: "Watch both boxes",
    body: "You can see where both packages are the whole way: dropped off, on the way, out for delivery, delivered.",
  },
  {
    icon: CheckCircle2,
    title: "Say it showed up",
    body: `When your box arrives, mark it delivered. That gives you ${INSPECTION_WINDOW_HOURS} hours to look it over.`,
  },
  {
    icon: ScanSearch,
    title: "Check everything",
    body: "Look at the condition and tick off each accessory from the agreement. You can only approve it if it all matches.",
  },
  {
    icon: Star,
    title: "Done, then review",
    body: "The trade only closes after you both approve. Then you review each other, and that builds your rep.",
  },
];

function Safety() {
  return (
    <div>
      <section className="relative overflow-hidden border-b bg-surface">
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-24">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">How every trade stays safe</h1>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
            Every trade goes through the same seven steps. That way you always know what's coming,
            where it is, and what to look for when it gets to you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ol className="relative space-y-6 border-l border-primary/40 pl-8">
          {stages.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="clip-chamfer-sm absolute -left-[49px] grid size-8 place-items-center bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="clip-chamfer border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <s.icon className="size-5 text-primary" /> {s.title}
                </h2>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">The packing checklist</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You check these off and snap a photo of the open box before you can buy a label. Both
              collectors can see each other's packing photo.
            </p>
            <ul className="mt-6 space-y-3">
              {PACKING_CHECKLIST.map((c) => (
                <li key={c} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {c}
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> A photo of the open
                box, taken right before you seal it
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">If something's wrong</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Missing accessory, damage from shipping, not what was described, or the other person
              never shipped? Report it. The trade freezes, you both get notified, and we look at the
              packing photos until it's sorted out.
            </p>
            <div className="mt-6 flex items-start gap-3 border border-warning/40 bg-warning/5 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              Don't put your home address, phone number or payment info in messages or listings.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold">Got something to trade?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/browse">
              Browse figures <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/listings/new">List a figure</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
