import { Link } from "@tanstack/react-router";
import { ImageOff, ShieldCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveImage } from "@/lib/marketplace/images";
import { PHASE_LABELS, type ReputationTier, type TradePhase } from "@/lib/marketplace/trade-logic";
import type { Collector, Condition } from "@/lib/marketplace/types";

const conditionVariant: Record<Condition, "success" | "info" | "crimson" | "warning" | "muted"> = {
  "Mint in Box": "success",
  "Near Mint": "info",
  Excellent: "crimson",
  Good: "warning",
  Fair: "muted",
};

export function ConditionBadge({
  condition,
  className,
}: {
  condition: Condition;
  className?: string;
}) {
  return (
    <Badge variant={conditionVariant[condition]} className={className}>
      {condition}
    </Badge>
  );
}

const phaseVariant: Record<
  TradePhase,
  "success" | "info" | "crimson" | "warning" | "muted" | "destructive"
> = {
  offer: "warning",
  declined: "muted",
  withdrawn: "muted",
  agreement: "info",
  shipping: "crimson",
  in_transit: "info",
  inspection: "warning",
  disputed: "destructive",
  completed: "success",
};

export function PhaseBadge({ phase, className }: { phase: TradePhase; className?: string }) {
  return (
    <Badge variant={phaseVariant[phase]} className={className}>
      {PHASE_LABELS[phase]}
    </Badge>
  );
}

export function CollectorAvatar({
  collector,
  size = "md",
  className,
}: {
  collector: Pick<Collector, "displayName" | "avatarHue">;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = collector.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  const sizes = {
    sm: "size-7 text-[0.6rem]",
    md: "size-10 text-xs",
    lg: "size-14 text-sm",
    xl: "size-24 text-2xl",
  };
  return (
    <div
      className={cn(
        "clip-chamfer-sm grid shrink-0 place-items-center bg-surface-raised font-display font-bold text-foreground ring-1 ring-border",
        sizes[size],
        className,
      )}
      // Per-collector hue is data, not a theme color: it only tints the avatar edge.
      style={{ boxShadow: `inset 0 -3px 0 oklch(0.6 0.18 ${collector.avatarHue})` }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

const tierVariant: Record<ReputationTier, "success" | "info" | "crimson" | "muted"> = {
  Elite: "crimson",
  Trusted: "success",
  Rising: "info",
  New: "muted",
};

export function TierBadge({ tier }: { tier: ReputationTier }) {
  return (
    <Badge variant={tierVariant[tier]}>
      <ShieldCheck className="size-3" /> {tier}
    </Badge>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function CollectorLink({
  collector,
  className,
}: {
  collector: Collector;
  className?: string;
}) {
  return (
    <Link
      to="/collectors/$username"
      params={{ username: collector.username }}
      className={cn("font-semibold hover:text-primary-glow", className)}
    >
      {collector.displayName}
    </Link>
  );
}

export function FigureImage({
  src,
  alt,
  className,
  eager,
}: {
  src: string | undefined;
  alt: string;
  className?: string | undefined;
  eager?: boolean | undefined;
}) {
  const url = resolveImage(src);
  if (!url) {
    return (
      <div
        className={cn(
          "grid h-full w-full place-items-center bg-surface text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={alt || "No photo"}
      >
        <ImageOff className="size-6" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      width={1024}
      height={1024}
      loading={eager ? "eager" : "lazy"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="clip-chamfer border border-dashed bg-surface px-6 py-12 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
