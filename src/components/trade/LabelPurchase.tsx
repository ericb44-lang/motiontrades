// The sender's shipping steps: private address, package, prices, pack + photo, pay.
// After Stripe confirms payment, the server buys the label and the trade moves to "label created".
import {
  Camera,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { market, useMyShipping } from "@/lib/marketplace/store";
import {
  BOX_PRESETS,
  EMPTY_ADDRESS,
  US_STATES,
  addressErrors,
  formatCents,
  priceBreakdown,
  type BoxPreset,
  type RateOption,
  type ShippingAddress,
} from "@/lib/marketplace/shipping";
import { PACKING_CHECKLIST } from "@/lib/marketplace/trade-logic";
import type { Trade } from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border bg-surface p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        {done ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <span className="grid size-5 place-items-center bg-primary text-[0.7rem] text-primary-foreground">
            {n}
          </span>
        )}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AddressForm({
  tradeId,
  initial,
  onDone,
}: {
  tradeId: string;
  initial: ShippingAddress;
  onDone: () => void;
}) {
  const [a, setA] = useState<ShippingAddress>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setA((p) => ({ ...p, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = addressErrors(a);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await market.saveShippingAddress(tradeId, a);
      toast.success("Address saved");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (
    k: keyof ShippingAddress,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`addr-${k}`}>{label}</Label>
      <Input id={`addr-${k}`} value={a[k]} onChange={set(k)} className="bg-card" {...props} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="space-y-3">
      {field("name", "Name on the label", { autoComplete: "name", maxLength: 60 })}
      {field("street1", "Street address", { autoComplete: "address-line1", maxLength: 80 })}
      {field("street2", "Apt, suite, etc. (optional)", {
        autoComplete: "address-line2",
        maxLength: 80,
      })}
      <div className="grid grid-cols-[1fr_90px_110px] gap-3">
        {field("city", "City", { autoComplete: "address-level2", maxLength: 50 })}
        <div className="space-y-1.5">
          <Label htmlFor="addr-state">State</Label>
          <Select value={a.state} onValueChange={(v) => setA((p) => ({ ...p, state: v }))}>
            <SelectTrigger id="addr-state" className="bg-card">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
        </div>
        {field("zip", "ZIP", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 10 })}
      </div>
      <Button type="submit" variant="hero" size="sm" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <MapPin />} Save address
      </Button>
    </form>
  );
}

function PackingPhoto({
  tradeId,
  path,
  onChange,
  disabled,
}: {
  tradeId: string;
  path: string | null;
  onChange: (path: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Coming back from the payment page: show the photo that's already saved.
  useEffect(() => {
    if (!path || preview) return;
    let live = true;
    void market.packingPhotoUrl(path).then((url) => live && url && setPreview(url));
    return () => {
      live = false;
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const saved = await market.uploadPackingPhoto(tradeId, file);
      setPreview(URL.createObjectURL(file));
      onChange(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="border bg-card p-3">
      <p className="text-sm font-semibold">Photo of your open box</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Take it right before you tape it shut, with the figure and accessories visible. Both of you
        can see it if there's ever a question about what was sent.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {preview ? (
          <img
            src={preview}
            alt="Your packed box"
            className="size-20 border object-cover"
            width={80}
            height={80}
          />
        ) : (
          <span className="grid size-20 place-items-center border border-dashed text-muted-foreground">
            <Camera className="size-6" />
          </span>
        )}
        <div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            id={`packing-photo-${tradeId}`}
            onChange={(e) => void pick(e.target.files?.[0])}
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant={path ? "outline" : "hero"}
            size="sm"
            onClick={() => input.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
            {path ? "Retake photo" : "Add photo"}
          </Button>
          {path && !uploading && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="size-3" /> Photo saved
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function LabelPurchase({ trade, otherName }: { trade: Trade; otherName: string }) {
  const mine = useMyShipping(trade.id);
  const [editingAddress, setEditingAddress] = useState(false);
  const [box, setBox] = useState<BoxPreset>(mine?.parcel?.box ?? "medium");
  const [weight, setWeight] = useState(mine?.parcel ? String(mine.parcel.weightLb) : "");
  const [rates, setRates] = useState<RateOption[]>(mine?.rates ?? []);
  const [rateId, setRateId] = useState<string | null>(mine?.selectedRateId ?? null);
  const [checks, setChecks] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(mine?.packingPhoto ?? null);
  const [busy, setBusy] = useState<"rates" | "pay" | null>(null);

  // Keep the price list in step with the server (it clears them when an address changes).
  useEffect(() => {
    setRates(mine?.rates ?? []);
    if (!mine?.rates?.some((r) => r.rateId === rateId)) setRateId(null);
  }, [mine?.rates]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAddress = !!mine?.address && !editingAddress;
  const pending = mine?.paymentStatus === "pending";
  const paid = mine?.paymentStatus === "paid";
  const selected = rates.find((r) => r.rateId === rateId);
  const price = selected ? priceBreakdown(selected.labelCents) : null;
  const checklistDone = PACKING_CHECKLIST.every((c) => checks.includes(c));
  const packed = checklistDone && !!photo;

  const fetchRates = async () => {
    setBusy("rates");
    try {
      const got = await market.getShippingRates(trade.id, { box, weightLb: Number(weight) });
      setRates(got);
      setRateId(got[0]?.rateId ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    if (!rateId || !photo) return;
    setBusy("pay");
    try {
      await market.payForLabel(trade.id, rateId, checks, photo);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  if (paid) {
    return (
      <div className="flex items-center gap-3 border border-success/40 bg-success/5 p-4 text-sm">
        <Loader2 className="size-4 animate-spin text-success" />
        Payment received. Creating your label now. This page updates by itself.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending && (
        <div className="flex items-start gap-3 border border-primary/40 bg-primary/5 p-4 text-sm">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
          <p>
            <span className="font-semibold">Checking on your payment.</span> If you finished paying,
            we'll buy your label as soon as Stripe confirms it, and this page updates by itself. If
            you left the payment page without paying, you can pay below.
          </p>
        </div>
      )}

      {mine?.failureMessage && (
        <p className="border border-warning/40 bg-warning/5 p-3 text-sm">{mine.failureMessage}</p>
      )}

      <Step n={1} title="Your shipping address" done={hasAddress}>
        {hasAddress && mine?.address ? (
          <div className="flex items-start justify-between gap-3 text-sm">
            <p>
              {mine.address.name}
              <br />
              {mine.address.street1}
              {mine.address.street2 ? `, ${mine.address.street2}` : ""}
              <br />
              {mine.address.city}, {mine.address.state} {mine.address.zip}
            </p>
            {!pending && (
              <Button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </div>
        ) : (
          <AddressForm
            tradeId={trade.id}
            initial={mine?.address ?? EMPTY_ADDRESS}
            onDone={() => setEditingAddress(false)}
          />
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3 shrink-0" />
          Only used for this trade's labels. It's printed as the return address on your label and
          the delivery address on {otherName}'s label. It's never shown anywhere on the site.
        </p>
      </Step>

      <Step n={2} title="Your package" done={!!selected}>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="box">Box size</Label>
            <Select value={box} onValueChange={(v) => setBox(v as BoxPreset)}>
              <SelectTrigger id="box" className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BOX_PRESETS).map(([k, b]) => (
                  <SelectItem key={k} value={k}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight">Packed weight (lb)</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 2.5"
              className="bg-card"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => void fetchRates()}
            disabled={!hasAddress || !Number(weight) || busy !== null || pending}
          >
            {busy === "rates" ? (
              <Loader2 className="animate-spin" />
            ) : rates.length ? (
              <RefreshCw />
            ) : (
              <Package />
            )}
            {rates.length ? "Update prices" : "Get prices"}
          </Button>
        </div>
        {!hasAddress && (
          <p className="mt-2 text-xs text-muted-foreground">Save your address first.</p>
        )}

        {rates.length > 0 && (
          <ul className="mt-4 space-y-2" role="radiogroup" aria-label="Shipping options">
            {rates.map((r) => {
              const total = priceBreakdown(r.labelCents).totalCents;
              return (
                <li key={r.rateId}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={r.rateId === rateId}
                    onClick={() => setRateId(r.rateId)}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border bg-card p-3 text-left text-sm transition-colors",
                      r.rateId === rateId
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-foreground/30",
                    )}
                  >
                    <span>
                      <span className="font-semibold">
                        {r.carrier} {r.service}
                      </span>
                      {r.estimatedDays ? (
                        <span className="block text-xs text-muted-foreground">
                          About {r.estimatedDays} day{r.estimatedDays === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-bold">{formatCents(total)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Step>

      <Step n={3} title="Pack it up" done={packed}>
        <ul className="space-y-2">
          {PACKING_CHECKLIST.map((c) => (
            <li key={c}>
              <label className="flex cursor-pointer items-start gap-3 border bg-card p-3 text-sm has-[[data-state=checked]]:border-success/50">
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
        <div className="mt-3">
          <PackingPhoto tradeId={trade.id} path={photo} onChange={setPhoto} />
        </div>
      </Step>

      <Step n={4} title="Pay and get your label">
        {price && selected ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {selected.carrier} {selected.service} label
              </dt>
              <dd>{formatCents(price.labelCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MOTIONTRADES service fee</dt>
              <dd>{formatCents(price.serviceFeeCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Card processing</dt>
              <dd>{formatCents(price.processingCents)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <dt>Total</dt>
              <dd>{formatCents(price.totalCents)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a shipping option to see your total.</p>
        )}
        <Button
          variant="hero"
          className="mt-4 w-full sm:w-auto"
          onClick={() => void pay()}
          disabled={!price || !packed || busy !== null}
        >
          {busy === "pay" ? <Loader2 className="animate-spin" /> : <CreditCard />}
          {price ? `Pay ${formatCents(price.totalCents)}` : "Pay"}
        </Button>
        {!packed && price && (
          <p className="mt-2 text-xs text-muted-foreground">
            {checklistDone
              ? "Add the photo of your open box to continue."
              : "Check off the packing list and add your photo to continue."}
          </p>
        )}
        {pending && (
          <p className="mt-2 text-xs text-muted-foreground">
            Only pay again if you closed the payment page without paying. If your first payment went
            through, we'll tell you instead of charging you twice.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Secure checkout by Stripe. If your label can't be created, you're refunded automatically.
        </p>
      </Step>
    </div>
  );
}
