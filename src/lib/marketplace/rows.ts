// Database row <-> app type mapping. Shared by the browser and the edge function.
import type { Collector, Listing, Report, Review } from "./types";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  region: string;
  bio: string;
  favorite_lines: string[];
  avatar_hue: number;
  completed_trades: number;
  disputes: number;
  created_at: string;
}

export interface ListingRow {
  id: string;
  owner_id: string;
  title: string;
  line: string;
  brand: string;
  year: number;
  scale: string;
  category: string;
  condition: string;
  condition_notes: string;
  description: string;
  accessories: string[];
  looking_for: string[];
  images: string[];
  status: string;
  views: number;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  collector_id: string;
  author_id: string;
  trade_id: string | null;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  category: string;
  description: string;
  desired_resolution: string;
  status: string;
  updates: { at: string; message: string }[];
  created_at: string;
}

export const PROFILE_COLUMNS =
  "id, username, display_name, region, bio, favorite_lines, avatar_hue, completed_trades, disputes, created_at";

export const rowToCollector = (r: ProfileRow): Collector => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  region: r.region,
  bio: r.bio,
  joinedAt: r.created_at,
  avatarHue: r.avatar_hue,
  favoriteLines: r.favorite_lines ?? [],
  // On-time rate isn't tracked yet; everyone starts at 100%.
  stats: { completedTrades: r.completed_trades, disputes: r.disputes, onTimeShipRate: 1 },
});

export const rowToListing = (r: ListingRow): Listing => ({
  id: r.id,
  ownerId: r.owner_id,
  title: r.title,
  line: r.line,
  brand: r.brand,
  year: r.year,
  scale: r.scale as Listing["scale"],
  category: r.category as Listing["category"],
  condition: r.condition as Listing["condition"],
  conditionNotes: r.condition_notes,
  description: r.description,
  accessories: r.accessories ?? [],
  lookingFor: r.looking_for ?? [],
  images: r.images ?? [],
  status: r.status as Listing["status"],
  createdAt: r.created_at,
  views: r.views,
});

export const listingToRow = (
  l: Omit<Listing, "id" | "ownerId" | "createdAt" | "views" | "status">,
) => ({
  title: l.title,
  line: l.line,
  brand: l.brand,
  year: l.year,
  scale: l.scale,
  category: l.category,
  condition: l.condition,
  condition_notes: l.conditionNotes,
  description: l.description,
  accessories: l.accessories,
  looking_for: l.lookingFor,
  images: l.images,
});

export const rowToReview = (r: ReviewRow): Review => ({
  id: r.id,
  collectorId: r.collector_id,
  authorId: r.author_id,
  tradeId: r.trade_id ?? undefined,
  rating: r.rating as Review["rating"],
  comment: r.comment,
  createdAt: r.created_at,
});

export const rowToReport = (r: ReportRow): Report => ({
  id: r.id,
  reporterId: r.reporter_id,
  targetType: r.target_type as Report["targetType"],
  targetId: r.target_id,
  category: r.category as Report["category"],
  description: r.description,
  desiredResolution: r.desired_resolution,
  status: r.status as Report["status"],
  createdAt: r.created_at,
  updates: r.updates ?? [],
});
