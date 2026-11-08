// GENERATED from src/lib/marketplace/types.ts by scripts/sync-edge-shared.mjs. Do not edit.
// Domain types for MOTIONTRADES. These mirror the shape a future database
// would store, so the in-browser demo store can be swapped for real tables.

export type Condition = "Mint in Box" | "Near Mint" | "Excellent" | "Good" | "Fair";

export const CONDITIONS: Condition[] = ["Mint in Box", "Near Mint", "Excellent", "Good", "Fair"];

export type Category = "Sci-Fi" | "Fantasy" | "Mecha" | "Adventure" | "Cyberpunk" | "Space";

export const CATEGORIES: Category[] = ["Sci-Fi", "Fantasy", "Mecha", "Adventure", "Cyberpunk", "Space"];

export type Scale = '6"' | '7"' | "1/12" | "1/6" | '4"';

export const SCALES: Scale[] = ['4"', '6"', '7"', "1/12", "1/6"];

export interface Collector {
  id: string;
  username: string;
  displayName: string;
  /** Private contact email. Never shown on public pages. Older browser-saved profiles may lack it. */
  email?: string;
  region: string; // broad region only — never an address
  bio: string;
  joinedAt: string;
  avatarHue: number;
  favoriteLines: string[];
  stats: {
    completedTrades: number;
    disputes: number;
    onTimeShipRate: number; // 0..1
  };
}

export interface Review {
  id: string;
  collectorId: string; // who is being reviewed
  authorId: string;
  tradeId?: string | undefined;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
}

export type ListingStatus = "active" | "paused" | "in_trade" | "traded";

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  line: string;
  brand: string;
  year: number;
  scale: Scale;
  category: Category;
  condition: Condition;
  conditionNotes: string;
  description: string;
  accessories: string[];
  lookingFor: string[];
  images: string[]; // image keys (bundled samples) or data URLs (user uploads)
  status: ListingStatus;
  createdAt: string;
  views: number;
}

/** Snapshot of a figure as written into a trade agreement. */
export interface TradeItem {
  listingId: string;
  title: string;
  image: string;
  condition: Condition;
  conditionNotes: string;
  accessories: string[];
}

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type Side = "proposer" | "receiver";

export const SHIP_STAGES = [
  "awaiting_agreement",
  "packing",
  "label_created",
  "dropped_off",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

export type ShipStage = (typeof SHIP_STAGES)[number];

export interface Inspection {
  result: "approved" | "issue";
  checkedAccessories: string[];
  notes: string;
  at: string;
}

/** A package sent BY one side of the trade. */
export interface Shipment {
  stage: ShipStage;
  history: { stage: ShipStage; at: string }[];
  trackingCode?: string | undefined; // simulated, never a real carrier number
  packingChecklist: string[];
  deliveryConfirmedAt?: string | undefined;
  inspection?: Inspection | undefined;
}

export interface Agreement {
  createdAt: string;
  shipWindowDays: number;
  inspectionWindowHours: number;
  terms: string[];
  signatures: { proposer?: string | undefined; receiver?: string | undefined };
}

export type ReportCategory =
  | "not_as_described"
  | "missing_accessories"
  | "damaged_in_transit"
  | "not_shipped"
  | "counterfeit"
  | "communication"
  | "other";

export type ReportStatus = "open" | "under_review" | "resolved";

export interface Report {
  id: string;
  reporterId: string;
  targetType: "trade" | "listing" | "collector";
  targetId: string;
  category: ReportCategory;
  description: string;
  desiredResolution: string;
  status: ReportStatus;
  createdAt: string;
  updates: { at: string; message: string }[];
}

export interface TimelineEvent {
  at: string;
  actorId?: string | undefined;
  message: string;
}

export interface Trade {
  id: string;
  proposerId: string;
  receiverId: string;
  proposerItems: TradeItem[];
  receiverItems: TradeItem[];
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
  agreement?: Agreement | undefined;
  shipments: Record<Side, Shipment>;
  timeline: TimelineEvent[];
  reviewedBy: string[];
}

export interface MarketState {
  /** Signed-in collector, or null until the visitor creates a profile. */
  currentUserId: string | null;
  collectors: Collector[];
  listings: Listing[];
  trades: Trade[];
  reviews: Review[];
  reports: Report[];
}
