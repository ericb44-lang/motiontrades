import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GALLERY, ShotImage } from "@/components/site/FigureShots";

const SOCIALS = [
  {
    label: "TikTok",
    handle: "@mass_motion",
    href: "https://www.tiktok.com/@mass_motion",
    icon: Video,
  },
  {
    label: "YouTube",
    handle: "@Mass_motion",
    href: "https://www.youtube.com/@Mass_motion/shorts",
    icon: Play,
  },
] as const;

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About me | MOTIONTRADES" },
      {
        name: "description",
        content:
          "Why MOTIONTRADES exists: a safer way for collectors to trade action figures without the fear of getting scammed.",
      },
      { property: "og:title", content: "About me | MOTIONTRADES" },
      {
        property: "og:description",
        content:
          "Built by a collector who got scammed, so other collectors can trade with confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="relative overflow-hidden border-b bg-surface">
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-24">
          <img
            src="/brand/about-me.jpg"
            alt="Mass Motion profile photo"
            width={160}
            height={160}
            className="mx-auto size-32 rounded-full object-cover shadow-xl ring-4 ring-primary ring-offset-4 ring-offset-background sm:size-40"
          />
          <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">Why I started MOTIONTRADES</h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="clip-chamfer border-l-2 border-primary bg-card p-8 sm:p-10">
          <p className="text-lg leading-relaxed text-foreground">
            Through my experience with trading, it is scary to trust someone and not be worried
            about being scammed! It is heavily based on trust, and that is where MOTIONTRADES comes
            in.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-foreground">
            I have once been scammed for some action figures that I dearly loved, and when I was
            scammed there was no way of getting them back. That is why I started this website: to
            help creators like me trade comfortably.
          </p>
        </div>

        <div className="mt-14">
          <h2 className="text-xl font-bold">From my shelf</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A few of my own figures. I shoot them around the house and around Utah.
          </p>
          <div className="mt-5 columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
            {GALLERY.map((shot) => (
              <figure
                key={shot.src}
                className="clip-chamfer-sm break-inside-avoid overflow-hidden border bg-card"
              >
                <ShotImage
                  shot={shot}
                  className="h-auto transition-transform duration-500 hover:scale-[1.03]"
                />
              </figure>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <h2 className="mb-4 text-xl font-bold">Come hang out on my channels</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="clip-chamfer group flex items-center gap-4 border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="clip-chamfer-sm grid size-12 shrink-0 place-items-center bg-primary text-primary-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{s.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">{s.handle}</span>
                </span>
                <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/safety">
              See how trades work <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/browse">Browse figures</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
