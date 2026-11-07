// The marketplace starts genuinely empty: no collectors, listings, trades or reviews.
// Test-only sample data lives in src/test/fixtures and is never imported by the app.
import type { MarketState } from "./types";

export function createEmptyState(): MarketState {
  return {
    currentUserId: null,
    collectors: [],
    listings: [],
    trades: [],
    reviews: [],
    reports: [],
  };
}
