// In-browser demo store. Every mutation goes through `market.*` so it can later
// be replaced with server functions backed by real accounts and a database.
import { useSyncExternalStore } from "react";
import { createEmptyState } from "./seed";
import * as logic from "./trade-logic";
import { toTradeItem } from "./trade-logic";
import type {
  Collector,
  Inspection,
  Listing,
  MarketState,
  Report,
  ReportCategory,
  Review,
  Side,
  Trade,
} from "./types";

// v2: the marketplace now starts empty. Older keys held fictional sample data and are discarded.
const STORAGE_KEY = "motiontrading:market:v2";
const LEGACY_KEYS = ["motiontrading:demo:v1"];
const SERVER_STATE = createEmptyState();

interface Snapshot {
  state: MarketState;
  hydrated: boolean;
}

let snapshot: Snapshot = { state: SERVER_STATE, hydrated: false };
const SERVER_SNAPSHOT: Snapshot = snapshot;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.state));
  } catch {
    // Storage full or unavailable — the demo keeps working in memory.
  }
}

function update(fn: (s: MarketState) => MarketState) {
  snapshot = { ...snapshot, state: fn(snapshot.state) };
  persist();
  emit();
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Load saved demo progress once on the client, after hydration. */
export function hydrateMarket() {
  if (snapshot.hydrated) return;
  let state = snapshot.state;
  try {
    LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as MarketState;
  } catch {
    state = createEmptyState();
  }
  snapshot = { state, hydrated: true };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
}

export function useMarket(): MarketState {
  return useSnapshot().state;
}

export function useMarketHydrated(): boolean {
  return useSnapshot().hydrated;
}

function mutateTrade(id: string, fn: (t: Trade) => Trade) {
  update((s) => ({ ...s, trades: s.trades.map((t) => (t.id === id ? fn(t) : t)) }));
}

function getTrade(id: string): Trade {
  const t = snapshot.state.trades.find((x) => x.id === id);
  if (!t) throw new Error("Trade not found");
  return t;
}

function setListingStatuses(ids: string[], status: Listing["status"]) {
  update((s) => ({
    ...s,
    listings: s.listings.map((l) => (ids.includes(l.id) ? { ...l, status } : l)),
  }));
}

const tradeListingIds = (t: Trade) => [...t.proposerItems, ...t.receiverItems].map((i) => i.listingId);

function afterTradeChange(id: string) {
  const t = getTrade(id);
  const phase = logic.getTradePhase(t, snapshot.state.reports);
  if (phase === "completed" && !t.timeline.some((e) => e.message.includes("trade complete"))) {
    mutateTrade(id, (x) => ({
      ...x,
      timeline: [...x.timeline, { at: now(), message: "Both sides approved. Trade complete!" }],
    }));
    setListingStatuses(tradeListingIds(t), "traded");
  }
}

/** The signed-in collector's id. Actions that need an account throw until a profile exists. */
function requireMe(): string {
  const id = snapshot.state.currentUserId;
  if (!id) throw new Error("Create your collector profile first");
  return id;
}

const trackingCode = () => `MT-SIM-${Math.floor(10000 + Math.random() * 89999)}`;

export type NewListingInput = Omit<Listing, "id" | "ownerId" | "createdAt" | "views" | "status">;

const takenEmails = () => snapshot.state.collectors.flatMap((c) => (c.email ? [c.email] : []));

export const market = {
  currentUserId: () => snapshot.state.currentUserId,

  /** Create a collector profile in this browser and sign in as it. */
  registerCollector(input: {
    displayName: string;
    username: string;
    email: string;
    region: string;
    bio: string;
    favoriteLines: string[];
  }): string {
    const username = input.username.trim().toLowerCase();
    const errors = logic.validateCollectorProfile(input, snapshot.state.collectors.map((c) => c.username));
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);
    const emailError = logic.validateEmail(input.email, takenEmails());
    if (emailError) throw new Error(emailError);
    const id = uid("u");
    const collector: Collector = {
      id,
      username,
      displayName: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
      region: input.region.trim(),
      bio: input.bio.trim(),
      joinedAt: now(),
      avatarHue: [...username].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7),
      favoriteLines: input.favoriteLines,
      stats: { completedTrades: 0, disputes: 0, onTimeShipRate: 1 },
    };
    update((s) => ({ ...s, collectors: [...s.collectors, collector], currentUserId: id }));
    return id;
  },

  /** Switch to a collector profile that already exists in this browser. */
  signIn(collectorId: string) {
    if (!snapshot.state.collectors.some((c) => c.id === collectorId)) throw new Error("Profile not found");
    update((s) => ({ ...s, currentUserId: collectorId }));
  },

  signOut() {
    update((s) => ({ ...s, currentUserId: null }));
  },

  createListing(input: NewListingInput): string {
    const id = uid("l");
    const listing: Listing = {
      ...input,
      id,
      ownerId: requireMe(),
      createdAt: now(),
      views: 0,
      status: "active",
    };
    update((s) => ({ ...s, listings: [listing, ...s.listings] }));
    return id;
  },

  updateListing(id: string, patch: Partial<NewListingInput>) {
    update((s) => ({
      ...s,
      listings: s.listings.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  },

  setListingStatus(id: string, status: "active" | "paused") {
    setListingStatuses([id], status);
  },

  deleteListing(id: string) {
    update((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id) }));
  },

  proposeTrade(input: {
    receiverId: string;
    offeredListingIds: string[];
    requestedListingIds: string[];
    message: string;
  }): string {
    const s = snapshot.state;
    const me = requireMe();
    const find = (id: string) => s.listings.find((l) => l.id === id)!;
    if (!input.offeredListingIds.length || !input.requestedListingIds.length) {
      throw new Error("Pick at least one figure on each side");
    }
    const at = now();
    const id = `t-${Math.floor(2000 + Math.random() * 7999)}`;
    const fresh = () => ({
      stage: "awaiting_agreement" as const,
      history: [{ stage: "awaiting_agreement" as const, at }],
      packingChecklist: [],
    });
    const trade: Trade = {
      id,
      proposerId: me,
      receiverId: input.receiverId,
      proposerItems: input.offeredListingIds.map((x) => toTradeItem(find(x))),
      receiverItems: input.requestedListingIds.map((x) => toTradeItem(find(x))),
      message: input.message,
      status: "pending",
      createdAt: at,
      updatedAt: at,
      shipments: { proposer: fresh(), receiver: fresh() },
      timeline: [{ at, actorId: me, message: "proposed a trade" }],
      reviewedBy: [],
    };
    update((st) => ({ ...st, trades: [trade, ...st.trades] }));
    return id;
  },

  acceptOffer(id: string, actorId = requireMe()) {
    const t = getTrade(id);
    mutateTrade(id, (x) => logic.acceptOffer(x, actorId, now()));
    setListingStatuses(tradeListingIds(t), "in_trade");
  },

  declineOffer(id: string, actorId = requireMe()) {
    mutateTrade(id, (x) => logic.declineOffer(x, actorId, now()));
  },

  withdrawOffer(id: string) {
    mutateTrade(id, (x) => logic.withdrawOffer(x, requireMe(), now()));
  },

  signAgreement(id: string, side: Side) {
    mutateTrade(id, (x) => logic.signAgreement(x, side, now()));
  },

  generateLabel(id: string, side: Side, checklist: string[]) {
    mutateTrade(id, (x) => logic.generateLabel(x, side, checklist, now(), trackingCode()));
  },

  markDroppedOff(id: string, side: Side) {
    mutateTrade(id, (x) => logic.markDroppedOff(x, side, now()));
  },

  simulateCarrierScan(id: string, side: Side) {
    mutateTrade(id, (x) => logic.advanceCarrier(x, side, now()));
  },

  confirmDelivery(id: string, senderSide: Side) {
    mutateTrade(id, (x) => logic.confirmDelivery(x, senderSide, now()));
  },

  submitInspection(id: string, senderSide: Side, inspection: Omit<Inspection, "at">) {
    mutateTrade(id, (x) => logic.submitInspection(x, senderSide, { ...inspection, at: now() }));
    afterTradeChange(id);
  },

  fileReport(input: {
    targetType: Report["targetType"];
    targetId: string;
    category: ReportCategory;
    description: string;
    desiredResolution: string;
  }): string {
    const at = now();
    const me = requireMe();
    const report: Report = {
      ...input,
      id: uid("r"),
      reporterId: me,
      status: "open",
      createdAt: at,
      updates: [{ at, message: "Report received. Both collectors were notified." }],
    };
    update((s) => ({ ...s, reports: [report, ...s.reports] }));
    if (input.targetType === "trade") {
      mutateTrade(input.targetId, (t) => ({
        ...t,
        updatedAt: at,
        timeline: [
          ...t.timeline,
          { at, actorId: me, message: `reported a problem: ${REPORT_CATEGORY_LABELS[input.category]}` },
        ],
      }));
    }
    return report.id;
  },

  /** Simulates the safety team moving a report forward. */
  advanceReport(id: string) {
    const r = snapshot.state.reports.find((x) => x.id === id);
    if (!r || r.status === "resolved") return;
    const at = now();
    const nextStatus = r.status === "open" ? "under_review" : "resolved";
    const message =
      nextStatus === "under_review"
        ? "Trade safety team is reviewing packing photos from both sides."
        : `Resolved: ${r.desiredResolution || "both collectors agreed on a resolution"}.`;
    update((s) => ({
      ...s,
      reports: s.reports.map((x) =>
        x.id === id ? { ...x, status: nextStatus, updates: [...x.updates, { at, message }] } : x,
      ),
    }));
    if (nextStatus === "resolved" && r.targetType === "trade") {
      mutateTrade(r.targetId, (t) => {
        const shipments = { ...t.shipments };
        (["proposer", "receiver"] as Side[]).forEach((side) => {
          const sh = shipments[side];
          if (sh.inspection?.result === "issue") {
            shipments[side] = {
              ...sh,
              inspection: { ...sh.inspection, result: "approved", notes: `${sh.inspection.notes} (Resolved through a report.)` },
            };
          }
        });
        return { ...t, shipments, updatedAt: at, timeline: [...t.timeline, { at, message: "Problem report resolved" }] };
      });
      afterTradeChange(r.targetId);
    }
  },

  leaveReview(tradeId: string, rating: Review["rating"], comment: string) {
    const t = getTrade(tradeId);
    const me = requireMe();
    const other = t.proposerId === me ? t.receiverId : t.proposerId;
    const review: Review = { id: uid("rv"), collectorId: other, authorId: me, tradeId, rating, comment, createdAt: now() };
    update((s) => ({ ...s, reviews: [review, ...s.reviews] }));
    mutateTrade(tradeId, (x) => ({ ...x, reviewedBy: [...x.reviewedBy, me] }));
  },

  /** Demo helper: perform the other collector's next step so the flow can be explored solo. */
  simulateCounterpart(id: string): string | null {
    const me = requireMe();
    const t = getTrade(id);
    const mySide = logic.sideOf(t, me);
    if (!mySide) return null;
    const them = logic.otherSide(mySide);
    const themId = logic.collectorIdFor(t, them);
    const phase = logic.getTradePhase(t, snapshot.state.reports);

    if (phase === "offer" && them === "receiver") {
      market.acceptOffer(id, themId);
      return "They accepted your offer";
    }
    if (phase === "agreement" && !t.agreement?.signatures[them]) {
      market.signAgreement(id, them);
      return "They signed the agreement";
    }
    const theirs = t.shipments[them];
    const mine = t.shipments[mySide];
    if (theirs.stage === "packing") {
      market.generateLabel(id, them, [...logic.PACKING_CHECKLIST]);
      return "They packed and created a label";
    }
    if (theirs.stage === "label_created") {
      market.markDroppedOff(id, them);
      return "They dropped off their package";
    }
    if (mine.stage === "delivered" && !mine.deliveryConfirmedAt) {
      market.confirmDelivery(id, mySide);
      return "They confirmed your package arrived";
    }
    if (mine.deliveryConfirmedAt && !mine.inspection) {
      const accessories = logic.itemsSentBy(t, mySide).flatMap((i) => i.accessories);
      market.submitInspection(id, mySide, { result: "approved", checkedAccessories: accessories, notes: "Everything matches the agreement." });
      return "They inspected and approved your figure";
    }
    return null;
  },

  /** Wipe everything saved in this browser and return to an empty marketplace. */
  clearLocalData() {
    snapshot = { state: createEmptyState(), hydrated: true };
    persist();
    emit();
  },
};

export { REPORT_CATEGORY_LABELS } from "./trade-logic";

/* ------------------------- selector helpers ------------------------- */

export const findCollector = (s: MarketState, id: string | null | undefined) => s.collectors.find((c) => c.id === id);
export const findCollectorByUsername = (s: MarketState, u: string) => s.collectors.find((c) => c.username === u);

export function completedTradeCount(s: MarketState, collectorId: string) {
  return s.trades.filter(
    (t) =>
      (t.proposerId === collectorId || t.receiverId === collectorId) &&
      logic.getTradePhase(t, s.reports) === "completed",
  ).length;
}

export function reputationFor(s: MarketState, collectorId: string) {
  const c = findCollector(s, collectorId);
  if (!c) return null;
  return logic.computeReputation(c, s.reviews, completedTradeCount(s, collectorId));
}

/** The signed-in collector profile, or undefined when the visitor hasn't joined yet. */
export function useMe(): Collector | undefined {
  const s = useMarket();
  return findCollector(s, s.currentUserId);
}
