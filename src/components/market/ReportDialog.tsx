import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { REPORT_CATEGORY_LABELS, market } from "@/lib/marketplace/store";
import type { Report, ReportCategory } from "@/lib/marketplace/types";

const CATEGORIES_BY_TARGET: Record<Report["targetType"], ReportCategory[]> = {
  trade: [
    "not_as_described",
    "missing_accessories",
    "damaged_in_transit",
    "not_shipped",
    "counterfeit",
    "communication",
    "other",
  ],
  listing: ["not_as_described", "counterfeit", "other"],
  collector: ["communication", "counterfeit", "other"],
};

export function ReportDialog({
  targetType,
  targetId,
  children,
  defaultCategory,
  onFiled,
}: {
  targetType: Report["targetType"];
  targetId: string;
  children: React.ReactNode;
  defaultCategory?: ReportCategory | undefined;
  onFiled?: ((id: string) => void) | undefined;
}) {
  const options = CATEGORIES_BY_TARGET[targetType];
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>(
    defaultCategory ?? options[0] ?? "other",
  );
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const id = await market.fileReport({
        targetType,
        targetId,
        category,
        description: description.trim(),
        desiredResolution: resolution.trim(),
      });
      toast.success("Report submitted", { description: "Our trade safety team will review it." });
      setOpen(false);
      setDescription("");
      setResolution("");
      onFiled?.(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Report a problem</DialogTitle>
          <DialogDescription>
            {targetType === "trade"
              ? "Reporting pauses this trade until the problem is reviewed. Both collectors are notified."
              : "Tell us what's wrong. Reports are reviewed by the trade safety team."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>What's the problem?</Label>
            <RadioGroup
              value={category}
              onValueChange={(v) => setCategory(v as ReportCategory)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {options.map((c) => (
                <Label
                  key={c}
                  htmlFor={`rc-${c}`}
                  className="flex cursor-pointer items-center gap-2 border p-3 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
                >
                  <RadioGroupItem id={`rc-${c}`} value={c} />
                  {REPORT_CATEGORY_LABELS[c]}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-desc">Describe what happened</Label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              className="bg-surface"
              placeholder="Be specific: which item, which accessory, and what you expected."
            />
          </div>
          {targetType === "trade" && (
            <div className="space-y-2">
              <Label htmlFor="report-res">What would resolve this?</Label>
              <Input
                id="report-res"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                maxLength={200}
                className="bg-surface"
                placeholder="e.g. Ship the missing accessory, return both figures"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            disabled={sending || description.trim().length < 10}
          >
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
