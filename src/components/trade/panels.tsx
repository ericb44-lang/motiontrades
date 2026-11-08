import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSignature,
  Lock,
  PackageCheck,
  ScanLine,
  Star,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConditionBadge, FigureImage } from "@/components/market/bits";
import { ReportDialog } from "@/components/market/ReportDialog";
import { REPORT_CATEGORY_LABELS, market, useIsAdmin } from "@/lib/marketplace/store";
import {
  PACKING_CHECKLIST,
  SHIP_STAGE_LABELS,
  canAdvanceCarrier,
  hasReached,
  itemsSentBy,
  otherSide,
  stageIndex,
} from "@/lib/marketplace/trade-logic";
import {
  SHIP_STAGES,
  type Collector,
  type Report,
  type Side,
  type Trade,
  type TradeItem,
} from "@/lib/marketplace/types";
import { formatDateTime, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Run a trade step, then show a success message or the server's explanation of what went wrong. */
const run = async (fn: () => unknown, ok?: string) => {
  try {
    await fn();
    if (ok) toast.success(ok);
  } catch (e) {
    toast.error((e as Error).message);
  }
};

export function Panel({
  title,
  icon: Icon,
  aside,
  children,
  className,
}: {
  title: string;
  icon?: typeof Truck;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("clip-chamfer border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {Icon && <Icon className="size-4 text-primary" />} {title}
        </h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ----------------------------- Items ----------------------------- */

export function ItemList({ items }: { items: TradeItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.listingId} className="flex gap-3">
          <div className="size-20 shrink-0 overflow-hidden border bg-surface">
            <FigureImage src={i.image} alt={i.title} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold leading-snug">{i.title}</p>
            <ConditionBadge condition={i.condition} className="mt-1.5" />
            {i.conditionNotes && (
              <p className="mt-1.5 text-xs text-muted-foreground">{i.conditionNotes}</p>
            )}
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Accessories ({i.accessories.length})
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {i.accessories.map((a) => (
                <li key={a} className="border bg-surface px-1.5 py-0.5 text-[0.7rem]">
                  {a}
                </li>
              ))}
              {i.accessories.length === 0 && (
                <li className="text-xs text-muted-foreground">Figure only</li>
              )}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TwoSides({ trade, names }: { trade: Trade; names: Record<Side, string> }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-0 md:divide-x">
      {(["proposer", "receiver"] as Side[]).map((side) => (
        <div key={side} className="md:px-5 md:first:pl-0 md:last:pr-0">
          <p className="eyebrow mb-3">{names[side]} sends</p>
          <ItemList items={itemsSentBy(trade, side)} />
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Agreement --------------------------- */

export function AgreementPanel({
  trade,
  mySide,
  people,
}: {
  trade: Trade;
  mySide: Side;
  people: Record<Side, Collector>;
}) {
  const a = trade.agreement!;
  const names = { proposer: people.proposer.displayName, receiver: people.receiver.displayName };
  const [typed, setTyped] = useState("");
  const [agree, setAgree] = useState(false);
  const me = people[mySide];
  const canSign = agree && typed.trim().toLowerCase() === me.displayName.toLowerCase();

  return (
    <Panel
      title="Written trade agreement"
      icon={FileSignature}
      aside={
        <span className="font-mono text-xs text-muted-foreground">
          Generated {formatShort(a.createdAt)}
        </span>
      }
    >
      <TwoSides trade={trade} names={names} />

      <div className="mt-8 border-t pt-6">
        <p className="eyebrow mb-3">Terms</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          {a.terms.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-xs text-primary-glow">
                {String(i + 1).padStart(2, "0")}
              </span>
              {t}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 grid gap-4 border-t pt-6 sm:grid-cols-2">
        {(["proposer", "receiver"] as Side[]).map((side) => {
          const signedAt = a.signatures[side];
          const isMe = side === mySide;
          return (
            <div
              key={side}
              className={cn(
                "border p-4",
                signedAt ? "border-success/40 bg-success/5" : "border-dashed",
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">
                {isMe ? "Your signature" : `${names[side]}'s signature`}
              </p>
              {signedAt ? (
                <>
                  <p className="mt-2 font-display text-lg font-bold italic">{names[side]}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-success">
                    <Check className="size-3" /> Signed {formatDateTime(signedAt)}
                  </p>
                </>
              ) : isMe ? (
                <div className="mt-3 space-y-3">
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={`Type "${me.displayName}" to sign`}
                    aria-label="Type your display name to sign"
                    className="bg-surface"
                  />
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={agree}
                      onCheckedChange={(v) => setAgree(v === true)}
                      className="mt-0.5"
                    />
                    I agree to ship exactly what's listed above and follow the terms.
                  </label>
                  <Button
                    size="sm"
                    variant="hero"
                    disabled={!canSign}
                    onClick={() =>
                      run(() => market.signAgreement(trade.id, side), "Agreement signed")
                    }
                  >
                    Sign agreement
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Awaiting signature</p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------------------------- Shipping ---------------------------- */

const VISIBLE_STAGES = SHIP_STAGES.filter((s) => s !== "awaiting_agreement");

export function ShipmentPanel({
  trade,
  senderSide,
  mySide,
  people,
}: {
  trade: Trade;
  senderSide: Side;
  mySide: Side;
  people: Record<Side, Collector>;
}) {
  const s = trade.shipments[senderSide];
  const isMine = senderSide === mySide;
  const sender = people[senderSide];
  const recipient = people[otherSide(senderSide)];
  const current = stageIndex(s.stage);
  const otherDropped = hasReached(trade.shipments[otherSide(senderSide)], "dropped_off");
  const [checks, setChecks] = useState<string[]>([]);
  const at = (stage: (typeof SHIP_STAGES)[number]) => s.history.find((h) => h.stage === stage)?.at;

  return (
    <Panel
      title={
        isMine ? `Your package → ${recipient.displayName}` : `${sender.displayName}'s package → you`
      }
      icon={Truck}
      aside={
        s.trackingCode ? (
          <span className="flex items-center gap-2 font-mono text-xs">
            {s.trackingCode} <Badge variant="muted">Trade code</Badge>
          </span>
        ) : (
          <Badge variant="muted">No label yet</Badge>
        )
      }
    >
      {/* Stage track */}
      <ol className="grid grid-cols-6 gap-1">
        {VISIBLE_STAGES.map((stage) => {
          const idx = stageIndex(stage);
          const done = idx <= current;
          const isCurrent = idx === current;
          return (
            <li key={stage} className="min-w-0">
              <div
                className={cn(
                  "h-1.5",
                  done ? "bg-primary" : "bg-muted",
                  isCurrent && "animate-pulse-crimson",
                )}
              />
              <p
                className={cn(
                  "mt-2 hidden text-[0.65rem] font-semibold leading-tight sm:block",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {SHIP_STAGE_LABELS[stage]}
              </p>
              {at(stage) && done && (
                <p className="hidden text-[0.6rem] text-muted-foreground sm:block">
                  {formatShort(at(stage)!)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm sm:hidden">
        <span className="text-muted-foreground">Status:</span>{" "}
        <span className="font-semibold">{SHIP_STAGE_LABELS[s.stage]}</span>
      </p>

      <div className="mt-6">
        {s.stage === "awaiting_agreement" && (
          <p className="text-sm text-muted-foreground">
            Shipping opens once both collectors sign the agreement.
          </p>
        )}

        {/* Sender actions */}
        {isMine && s.stage === "packing" && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">Packing checklist</p>
            <ul className="space-y-2">
              {PACKING_CHECKLIST.map((c) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-start gap-3 border bg-surface p-3 text-sm has-[[data-state=checked]]:border-success/50">
                    <Checkbox
                      checked={checks.includes(c)}
                      onCheckedChange={(v) =>
                        setChecks((p) => (v ? [...p, c] : p.filter((x) => x !== c)))
                      }
                      className="mt-0.5"
                    />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="hero"
                disabled={checks.length < PACKING_CHECKLIST.length}
                onClick={() =>
                  run(() => market.generateLabel(trade.id, senderSide, checks), "Packing confirmed")
                }
              >
                <ScanLine /> Confirm packing
              </Button>
              <p className="text-xs text-muted-foreground">
                You'll print your own shipping label for now. Keep the trade code with your package.
              </p>
            </div>
          </div>
        )}

        {isMine && s.stage === "label_created" && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="hero"
              onClick={() =>
                run(() => market.markDroppedOff(trade.id, senderSide), "Marked as dropped off")
              }
            >
              <PackageCheck /> Mark as dropped off
            </Button>
            <p className="text-xs text-muted-foreground">
              Drop off within {trade.agreement?.shipWindowDays} days of signing.
            </p>
          </div>
        )}

        {!isMine && (s.stage === "packing" || s.stage === "label_created") && (
          <p className="text-sm text-muted-foreground">
            {sender.displayName} is preparing their package.
          </p>
        )}

        {/* Dual drop-off lock */}
        {s.stage === "dropped_off" && !otherDropped && (
          <div className="flex items-start gap-3 border border-dashed p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
            Tracking goes live for both sides once {isMine ? recipient.displayName : "you"} also
            drop{isMine ? "s" : ""} off.
          </div>
        )}

        {isMine && canAdvanceCarrier(trade, senderSide) && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void run(() => market.updateTracking(trade.id))}
            >
              <Truck /> Mark as{" "}
              {SHIP_STAGE_LABELS[SHIP_STAGES[stageIndex(s.stage) + 1]!].toLowerCase()}
            </Button>
            <span className="text-xs text-muted-foreground">
              Update this when the carrier tracking changes.
            </span>
          </div>
        )}

        {/* Recipient: delivery + inspection */}
        {!isMine && s.stage === "delivered" && !s.deliveryConfirmedAt && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="hero"
              onClick={() =>
                run(
                  () => market.confirmDelivery(trade.id, senderSide),
                  "Got it. Time to check it over.",
                )
              }
            >
              <CheckCircle2 /> Confirm package arrived
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll then have {trade.agreement?.inspectionWindowHours} hours to inspect.
            </p>
          </div>
        )}

        {!isMine && s.deliveryConfirmedAt && !s.inspection && (
          <InspectionForm trade={trade} senderSide={senderSide} />
        )}

        {s.inspection && (
          <InspectionResult
            result={s.inspection.result}
            notes={s.inspection.notes}
            at={s.inspection.at}
            by={isMine ? recipient.displayName : "You"}
          />
        )}

        {isMine && s.stage === "delivered" && !s.inspection && (
          <p className="text-sm text-muted-foreground">
            Delivered. Waiting for {recipient.displayName} to{" "}
            {s.deliveryConfirmedAt ? "finish inspecting" : "confirm delivery"}.
          </p>
        )}
      </div>
    </Panel>
  );
}

function InspectionResult({
  result,
  notes,
  at,
  by,
}: {
  result: "approved" | "issue";
  notes: string;
  at: string;
  by: string;
}) {
  const ok = result === "approved";
  return (
    <div
      className={cn(
        "flex items-start gap-3 border p-4",
        ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5",
      )}
    >
      {ok ? (
        <CheckCircle2 className="size-5 shrink-0 text-success" />
      ) : (
        <AlertTriangle className="size-5 shrink-0 text-destructive" />
      )}
      <div className="text-sm">
        <p className="font-semibold">
          {ok ? `Inspection approved by ${by}` : `Issue flagged by ${by}`}
        </p>
        {notes && <p className="mt-1 text-muted-foreground">“{notes}”</p>}
        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(at)}</p>
      </div>
    </div>
  );
}

function InspectionForm({ trade, senderSide }: { trade: Trade; senderSide: Side }) {
  const items = itemsSentBy(trade, senderSide);
  const accessories = items.flatMap((i) => i.accessories);
  const [checked, setChecked] = useState<string[]>([]);
  const [conditionOk, setConditionOk] = useState(false);
  const [notes, setNotes] = useState("");
  const allOk = conditionOk && accessories.every((a) => checked.includes(a));

  const toggle = (a: string, v: boolean) =>
    setChecked((p) => (v ? [...p, a] : p.filter((x) => x !== a)));

  return (
    <div className="space-y-5 border border-warning/40 bg-warning/5 p-4">
      <div>
        <p className="font-semibold">Inspect what you received</p>
        <p className="text-sm text-muted-foreground">
          Compare against the written agreement before approving.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <Checkbox
          checked={conditionOk}
          onCheckedChange={(v) => setConditionOk(v === true)}
          className="mt-0.5"
        />
        <span>
          Figure{items.length > 1 ? "s match" : " matches"} the agreed condition:{" "}
          <span className="text-muted-foreground">
            {items.map((i) => `${i.title} (${i.condition})`).join(", ")}
          </span>
        </span>
      </label>

      {accessories.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Accessories received</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {accessories.map((a) => (
              <li key={a}>
                <label className="flex cursor-pointer items-center gap-2 border bg-card p-2.5 text-sm has-[[data-state=checked]]:border-success/50">
                  <Checkbox
                    checked={checked.includes(a)}
                    onCheckedChange={(v) => toggle(a, v === true)}
                  />
                  {a}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="insp-notes">Notes (optional)</Label>
        <Textarea
          id="insp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={400}
          rows={2}
          className="bg-card"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="success"
          disabled={!allOk}
          onClick={() =>
            run(
              () =>
                market.submitInspection(trade.id, senderSide, {
                  result: "approved",
                  checkedAccessories: checked,
                  notes: notes.trim(),
                }),
              "Inspection approved",
            )
          }
        >
          <Check /> Everything matches, approve
        </Button>
        <ReportDialog
          targetType="trade"
          targetId={trade.id}
          defaultCategory={
            accessories.some((a) => !checked.includes(a))
              ? "missing_accessories"
              : "not_as_described"
          }
          onFiled={() =>
            run(() =>
              market.submitInspection(trade.id, senderSide, {
                result: "issue",
                checkedAccessories: checked,
                notes: notes.trim() || "Issue reported during inspection.",
              }),
            )
          }
        >
          <Button variant="outline">
            <AlertTriangle /> Something's wrong
          </Button>
        </ReportDialog>
      </div>
    </div>
  );
}

/* ----------------------------- Reports ----------------------------- */

export function ReportsPanel({ reports }: { reports: Report[] }) {
  const isAdmin = useIsAdmin();
  if (!reports.length) return null;
  return (
    <Panel title="Problem reports" icon={AlertTriangle} className="border-destructive/40">
      <div className="space-y-6">
        {reports.map((r) => (
          <div key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{REPORT_CATEGORY_LABELS[r.category]}</p>
              <Badge
                variant={
                  r.status === "resolved"
                    ? "success"
                    : r.status === "under_review"
                      ? "warning"
                      : "destructive"
                }
              >
                {r.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
            {r.desiredResolution && (
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Requested resolution:</span>{" "}
                {r.desiredResolution}
              </p>
            )}
            <ol className="mt-4 space-y-3 border-l pl-4">
              {r.updates.map((u, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2 bg-primary" />
                  <p>{u.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(u.at)}</p>
                </li>
              ))}
            </ol>
            {isAdmin && r.status !== "resolved" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void run(() => market.advanceReport(r.id), "Report updated")}
              >
                {r.status === "open" ? "Safety team: start review" : "Safety team: mark resolved"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ----------------------------- Review ----------------------------- */

export function ReviewPanel({
  trade,
  otherName,
  reviewed,
}: {
  trade: Trade;
  otherName: string;
  reviewed: boolean;
}) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment, setComment] = useState("");
  if (reviewed) {
    return (
      <Panel title="Review" icon={Star}>
        <p className="text-sm text-muted-foreground">
          Thanks! Your review of {otherName} now counts toward their rep.
        </p>
      </Panel>
    );
  }
  return (
    <Panel title={`Review ${otherName}`} icon={Star}>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
          >
            <Star
              className={cn(
                "size-7",
                n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={400}
        rows={3}
        placeholder="How was packing, communication and accuracy?"
        className="mt-4 bg-surface"
      />
      <Button
        className="mt-4"
        variant="hero"
        disabled={comment.trim().length < 5}
        onClick={() =>
          run(() => market.leaveReview(trade.id, rating, comment.trim()), "Review posted")
        }
      >
        Post review
      </Button>
    </Panel>
  );
}

/* ----------------------------- Timeline ----------------------------- */

export function Timeline({
  trade,
  nameOf,
}: {
  trade: Trade;
  nameOf: (id?: string) => string | undefined;
}) {
  const events = [...trade.timeline].reverse();
  return (
    <ol className="space-y-4">
      {events.map((e, i) => {
        const name = nameOf(e.actorId);
        return (
          <li key={i} className="relative border-l pl-4 text-sm">
            <span
              className={cn(
                "absolute -left-[4px] top-1.5 size-2",
                i === 0 ? "bg-primary" : "bg-muted-foreground/50",
              )}
            />
            <p>
              {name && <span className="font-semibold">{name} </span>}
              <span className={name ? "text-muted-foreground" : ""}>{e.message}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
