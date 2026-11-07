import { ImagePlus, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fileToCompressedDataUrl } from "@/lib/marketplace/images";
import type { NewListingInput } from "@/lib/marketplace/store";
import {
  CATEGORIES,
  CONDITIONS,
  SCALES,
  type Category,
  type Condition,
  type Scale,
} from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";
import { FigureImage } from "./bits";

const MAX_PHOTOS = 5;

export const EMPTY_LISTING: NewListingInput = {
  title: "",
  line: "",
  brand: "",
  year: 2026,
  scale: '6"',
  category: "Sci-Fi",
  condition: "Near Mint",
  conditionNotes: "",
  description: "",
  accessories: [],
  lookingFor: [],
  images: [],
};

export function ListingForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: NewListingInput;
  submitLabel: string;
  onSubmit: (v: NewListingInput) => void;
}) {
  const [v, setV] = useState<NewListingInput>(initial);
  const [accessory, setAccessory] = useState("");
  const [wish, setWish] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"title" | "brand" | "line" | "description" | "images" | "year", string>>
  >({});
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof NewListingInput>(k: K, val: NewListingInput[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const addTo = (k: "accessories" | "lookingFor", val: string, clear: () => void) => {
    const t = val.trim();
    if (!t || v[k].includes(t)) return;
    set(k, [...v[k], t.slice(0, 60)]);
    clear();
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - v.images.length;
    const picked = Array.from(files).slice(0, room);
    try {
      const urls = await Promise.all(picked.map((f) => fileToCompressedDataUrl(f)));
      set("images", [...v.images, ...urls]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const validate = () => {
    const e: Partial<
      Record<"title" | "brand" | "line" | "description" | "images" | "year", string>
    > = {};
    if (v.title.trim().length < 3) e.title = "Give your figure a name (3+ characters)";
    if (!v.brand.trim()) e.brand = "Brand is required";
    if (!v.line.trim()) e.line = "Line or series is required";
    if (v.description.trim().length < 20)
      e.description = "Describe the figure in at least 20 characters";
    if (!v.images.length) e.images = "Add at least one photo";
    if (v.year < 1960 || v.year > 2030) e.year = "Enter a year between 1960 and 2030";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form
      className="grid gap-10 lg:grid-cols-[1fr_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate()) {
          toast.error("Please fix the highlighted fields");
          return;
        }
        onSubmit({
          ...v,
          title: v.title.trim(),
          brand: v.brand.trim(),
          line: v.line.trim(),
          description: v.description.trim(),
          conditionNotes: v.conditionNotes.trim(),
        });
      }}
    >
      <div className="space-y-10">
        <Section title="Photos" hint={`Up to ${MAX_PHOTOS}. The first photo is the cover.`}>
          {v.images.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {v.images.map((src, i) => (
                <div
                  key={src.slice(0, 40) + i}
                  className="group relative aspect-square overflow-hidden border bg-surface"
                >
                  <FigureImage src={src} alt={`Photo ${i + 1}`} />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 bg-primary px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-primary-foreground">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "images",
                        v.images.filter((_, j) => j !== i),
                      )
                    }
                    className="absolute right-1 top-1 grid size-6 place-items-center bg-background/80"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> Upload photos
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="text-xs text-muted-foreground">Photos are saved in this browser.</span>
          </div>
          <FieldError msg={errors.images} />
        </Section>

        <Section title="Figure details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Figure name" error={errors.title} className="sm:col-span-2">
              <Input
                value={v.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={80}
                placeholder="e.g. Sentinel X-9 'Gunmetal'"
              />
            </Field>
            <Field label="Brand" error={errors.brand}>
              <Input
                value={v.brand}
                onChange={(e) => set("brand", e.target.value)}
                maxLength={50}
                placeholder="e.g. Forgeline"
              />
            </Field>
            <Field label="Line / series" error={errors.line}>
              <Input
                value={v.line}
                onChange={(e) => set("line", e.target.value)}
                maxLength={50}
                placeholder="e.g. Iron Protocol"
              />
            </Field>
            <Field label="Year" error={errors.year}>
              <Input
                type="number"
                value={v.year}
                onChange={(e) => set("year", Number(e.target.value))}
              />
            </Field>
            <Field label="Scale">
              <Select value={v.scale} onValueChange={(x) => set("scale", x as Scale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" className="sm:col-span-2">
              <Select value={v.category} onValueChange={(x) => set("category", x as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" error={errors.description} className="sm:col-span-2">
              <Textarea
                rows={4}
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={1200}
                placeholder="Deco, articulation, what makes it special…"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Condition"
          hint="Be exact. This goes word for word into the trade agreement."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("condition", c as Condition)}
                aria-pressed={v.condition === c}
                className={cn(
                  "border px-3 py-3 text-sm font-semibold transition-colors",
                  v.condition === c
                    ? "border-primary bg-primary/15"
                    : "text-muted-foreground hover:border-primary/50",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Field label="Condition notes" className="mt-5">
            <Textarea
              rows={3}
              value={v.conditionNotes}
              onChange={(e) => set("conditionNotes", e.target.value)}
              maxLength={500}
              placeholder="Scuffs, loose joints, box wear, missing tags…"
            />
          </Field>
        </Section>

        <Section
          title="Accessories"
          hint="List every included piece. Recipients check these off during inspection."
        >
          <ChipInput
            value={accessory}
            onChange={setAccessory}
            onAdd={() => addTo("accessories", accessory, () => setAccessory(""))}
            placeholder="e.g. Alternate head"
            chips={v.accessories}
            onRemove={(a) =>
              set(
                "accessories",
                v.accessories.filter((x) => x !== a),
              )
            }
          />
        </Section>

        <Section
          title="Looking for"
          hint="Optional. Helps other collectors make offers you'll like."
        >
          <ChipInput
            value={wish}
            onChange={setWish}
            onAdd={() => addTo("lookingFor", wish, () => setWish(""))}
            placeholder="e.g. Heavy mecha in 1/12"
            chips={v.lookingFor}
            onRemove={(a) =>
              set(
                "lookingFor",
                v.lookingFor.filter((x) => x !== a),
              )
            }
          />
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="clip-chamfer border bg-card p-5">
          <p className="eyebrow mb-3">Preview</p>
          <div className="aspect-square overflow-hidden bg-surface">
            {v.images[0] ? (
              <FigureImage src={v.images[0]} alt="Cover preview" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No photo yet
              </div>
            )}
          </div>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {v.brand || "Brand"} · {v.line || "Line"}
          </p>
          <p className="mt-1 font-display text-sm font-bold">{v.title || "Figure name"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {v.condition} · {v.accessories.length} accessories
          </p>
          <Button type="submit" variant="hero" className="mt-5 w-full">
            {submitLabel}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Never include addresses, phone numbers or payment info in a listing.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function FieldError({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="text-xs font-medium text-destructive">{msg}</p> : null;
}

function ChipInput({
  value,
  onChange,
  onAdd,
  placeholder,
  chips,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  chips: string[];
  onRemove: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={60}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onAdd} aria-label="Add">
          <Plus />
        </Button>
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 border bg-surface py-1 pl-3 pr-1 text-sm"
            >
              {c}
              <button
                type="button"
                onClick={() => onRemove(c)}
                className="grid size-5 place-items-center hover:text-primary"
                aria-label={`Remove ${c}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
