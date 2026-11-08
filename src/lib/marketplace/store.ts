// Marketplace data store, backed by Supabase.
//
// Pages read a snapshot of the marketplace through useMarket() and change it only through
// `market.*`. Reads come straight from the database (row-level security decides what each
// person may see). Listing and profile edits go to the database directly; every trade,
// review and report step goes through the `trade-action` edge function, which runs the
// same tested rules as trade-logic.ts.
import { useSyncExternalStore } from "react";
import { appUrl, PHOTO_BUCKET, supabase } from "@/lib/supabase";
import { compressPhoto } from "./images";
import {
  listingToRow,
  PROFILE_COLUMNS,
  rowToCollector,
  rowToListing,
  rowToReport,
  rowToReview,
  type ListingRow,
  type ProfileRow,
  type ReportRow,
  type ReviewRow,
} from "./rows";
import { createEmptyState } from "./seed";
import * as logic from "./trade-logic";
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

interface Snapshot {
  state: MarketState;
  /** True once the first load from the database has finished. */
  hydrated: boolean;
  isAdmin: boolean;
  /** The signed-in user's private email (never part of public data). */
  email: string | null;
  /** Set when someone arrives from a "reset your password" email. */
  recovering: boolean;
}

const SERVER_SNAPSHOT: Snapshot = {
  state: createEmptyState(),
  hydrated: false,
  isAdmin: false,
  email: null,
  recovering: false,
};
let snapshot: Snapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

/* ------------------------------ loading ------------------------------ */

let currentUserId: string | null = null;
let loadSeq = 0;

async function refresh() {
  const seq = ++loadSeq;
  const db = supabase();
  const me = currentUserId;
  const [profiles, listings, trades, reviews, reports] = await Promise.all([
    db.from("profiles").select(`${PROFILE_COLUMNS}, is_admin`),
    db.from("listings").select("*").order("created_at", { ascending: false }),
    me
      ? db.from("trades").select("doc").order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    db.from("reviews").select("*").order("created_at", { ascending: false }),
    me
      ? db.from("reports").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (seq !== loadSeq) return; // a newer load already started
  const firstError = [profiles, listings, trades, reviews, reports].find((r) => r.error)?.error;
  if (firstError) console.error("Couldn't load the marketplace", firstError);

  const profileRows = (profiles.data ?? []) as (ProfileRow & { is_admin: boolean })[];
  set({
    hydrated: true,
    isAdmin: Boolean(me && profileRows.find((p) => p.id === me)?.is_admin),
    state: {
      currentUserId: me,
      collectors: profileRows.map(rowToCollector),
      listings: ((listings.data ?? []) as ListingRow[]).map(rowToListing),
      trades: ((trades.data ?? []) as { doc: Trade }[]).map((r) => r.doc),
      reviews: ((reviews.data ?? []) as ReviewRow[]).map(rowToReview),
      reports: ((reports.data ?? []) as ReportRow[]).map(rowToReport),
    },
  });
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refresh(), 300);
}

let started = false;

/** Connect to the database once, in the browser, after the page has hydrated. */
export function hydrateMarket() {
  if (started) return;
  started = true;
  const db = supabase();

  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") set({ recovering: true });
    const uid = session?.user.id ?? null;
    set({ email: session?.user.email ?? null });
    if (event === "SIGNED_IN" && window.location.search.includes("code=")) {
      // Tidy the address bar after arriving from an email link.
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState(null, "", url.toString());
    }
    if (event === "INITIAL_SESSION" || uid !== currentUserId) {
      currentUserId = uid;
      // Supabase asks that auth callbacks don't await other calls directly.
      setTimeout(() => void refresh(), 0);
    }
  });

  // Live updates: someone accepts your offer, a new figure is listed, and so on.
  db.channel("market")
    .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, scheduleRefresh)
    .subscribe();

  window.addEventListener("focus", scheduleRefresh);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useSnapshot(): Snapshot {
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

export const useIsAdmin = () => useSnapshot().isAdmin;
export const useMyEmail = () => useSnapshot().email;
export const usePasswordRecovery = () => useSnapshot().recovering;

/* ------------------------------ helpers ------------------------------ */

function requireMe(): string {
  if (!currentUserId) throw new Error("Log in first");
  return currentUserId;
}

/** Call the trade-action edge function and turn its errors into readable messages. */
async function act<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  requireMe();
  const { data, error } = await supabase().functions.invoke("trade-action", { body });
  if (error) {
    let message = "Something went wrong. Check your connection and try again.";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // keep the generic message
      }
    }
    await refresh(); // the trade may have changed under us
    throw new Error(message);
  }
  await refresh();
  return data as T;
}

const AUTH_MESSAGES: [RegExp, string][] = [
  [
    /invalid login credentials/i,
    "That email and password don't match. Try again or reset your password.",
  ],
  [/email not confirmed/i, "Check your email and click the confirmation link first."],
  [
    /already registered|already exists/i,
    "An account with that email already exists. Try logging in.",
  ],
  [/password should be at least|weak password/i, "Pick a longer password: at least 8 characters."],
  [/rate limit|too many/i, "Too many tries in a short time. Wait a few minutes and try again."],
  [/database error saving new user/i, "That username was just taken. Pick another one."],
  [
    /email_address_not_authorized|not authorized/i,
    "We can't send email to that address yet. The site is still in testing.",
  ],
  [/email rate limit/i, "We've sent too many emails in the last hour. Try again a little later."],
];

function authError(message: string): Error {
  return new Error(AUTH_MESSAGES.find(([re]) => re.test(message))?.[1] ?? message);
}

export type NewListingInput = Omit<Listing, "id" | "ownerId" | "createdAt" | "views" | "status">;

export const MIN_PASSWORD_LENGTH = 8;

/* ------------------------------ actions ------------------------------ */

export const market = {
  currentUserId: () => currentUserId,

  /* ----- accounts ----- */

  /** Create an account. Resolves with needsConfirmation when Supabase emails a confirm link first. */
  async registerCollector(input: {
    displayName: string;
    username: string;
    email: string;
    password: string;
    region: string;
    bio: string;
    favoriteLines: string[];
  }): Promise<{ needsConfirmation: boolean }> {
    const db = supabase();
    const username = input.username.trim().toLowerCase();
    const errors = logic.validateCollectorProfile(input, []);
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);
    const emailError = logic.validateEmail(input.email, []);
    if (emailError) throw new Error(emailError);
    if (input.password.length < MIN_PASSWORD_LENGTH)
      throw new Error("Pick a longer password: at least 8 characters.");

    const { data: available, error: checkError } = await db.rpc("username_available", {
      name: username,
    });
    if (checkError) throw new Error("Couldn't check that username. Try again.");
    if (!available) throw new Error("That username is already taken");

    const { data, error } = await db.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: appUrl("/"),
        data: {
          username,
          display_name: input.displayName.trim(),
          region: input.region.trim(),
          bio: input.bio.trim(),
          favorite_lines: input.favoriteLines,
        },
      },
    });
    if (error) throw authError(error.message);
    // With email confirmation on, Supabase hides whether an email is taken by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) throw authError("already registered");
    return { needsConfirmation: !data.session };
  },

  async logIn(email: string, password: string) {
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw authError(error.message);
  },

  async signOut() {
    await supabase().auth.signOut();
  },

  async requestPasswordReset(email: string) {
    const emailError = logic.validateEmail(email, []);
    if (emailError) throw new Error(emailError);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: appUrl("/reset-password"),
    });
    if (error) throw authError(error.message);
  },

  async updatePassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH)
      throw new Error("Pick a longer password: at least 8 characters.");
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw authError(error.message);
    set({ recovering: false });
  },

  async resendConfirmation(email: string) {
    const { error } = await supabase().auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: appUrl("/") },
    });
    if (error) throw authError(error.message);
  },

  /* ----- photos ----- */

  /** Shrink and upload one photo to the signed-in user's folder. Returns its storage path. */
  async uploadPhoto(file: File): Promise<string> {
    const me = requireMe();
    const blob = await compressPhoto(file);
    const path = `${me}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase()
      .storage.from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (error) throw new Error(`Couldn't upload "${file.name}". ${error.message}`);
    return path;
  },

  /* ----- listings ----- */

  async createListing(input: NewListingInput): Promise<string> {
    requireMe();
    const { data, error } = await supabase()
      .from("listings")
      .insert(listingToRow(input))
      .select("id")
      .single();
    if (error) throw new Error(`Couldn't save the listing. ${error.message}`);
    await refresh();
    return data.id as string;
  },

  async updateListing(id: string, patch: NewListingInput) {
    requireMe();
    const { data, error } = await supabase()
      .from("listings")
      .update(listingToRow(patch))
      .eq("id", id)
      .select("id");
    if (error) throw new Error(`Couldn't save your changes. ${error.message}`);
    if (!data.length) throw new Error("You can't edit a figure while it's in a trade.");
    await refresh();
  },

  async setListingStatus(id: string, status: "active" | "paused") {
    requireMe();
    const { data, error } = await supabase()
      .from("listings")
      .update({ status })
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data.length)
      throw new Error("This figure is in a trade right now, so it can't be changed.");
    await refresh();
  },

  async deleteListing(id: string) {
    requireMe();
    const { data, error } = await supabase().from("listings").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data.length)
      throw new Error("This figure is in a trade right now, so it can't be deleted.");
    await refresh();
  },

  /** Count a view once per browser session (never for your own listing). */
  recordView(listingId: string) {
    const key = `mt:viewed:${listingId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // private mode: still count it
    }
    void supabase().rpc("increment_listing_views", { listing: listingId });
  },

  /* ----- trades (all checked on the server) ----- */

  async proposeTrade(input: {
    receiverId: string;
    offeredListingIds: string[];
    requestedListingIds: string[];
    message: string;
  }): Promise<string> {
    const res = await act<{ tradeId: string }>({ action: "propose", ...input });
    return res.tradeId;
  },

  acceptOffer: (id: string) => act({ action: "accept", tradeId: id }),
  declineOffer: (id: string) => act({ action: "decline", tradeId: id }),
  withdrawOffer: (id: string) => act({ action: "withdraw", tradeId: id }),

  // `side` arguments are kept for the pages' convenience; the server always uses YOUR side.
  signAgreement: (id: string, _side?: Side) => act({ action: "sign", tradeId: id }),
  generateLabel: (id: string, _side: Side, checklist: string[]) =>
    act({ action: "label", tradeId: id, checklist }),
  markDroppedOff: (id: string, _side?: Side) => act({ action: "dropOff", tradeId: id }),
  updateTracking: (id: string, _side?: Side) => act({ action: "carrierScan", tradeId: id }),
  confirmDelivery: (id: string, _senderSide?: Side) =>
    act({ action: "confirmDelivery", tradeId: id }),
  submitInspection: (id: string, _senderSide: Side, inspection: Omit<Inspection, "at">) =>
    act({ action: "inspect", tradeId: id, ...inspection }),

  async fileReport(input: {
    targetType: Report["targetType"];
    targetId: string;
    category: ReportCategory;
    description: string;
    desiredResolution: string;
  }): Promise<string> {
    const res = await act<{ reportId: string }>({ action: "report", ...input });
    return res.reportId;
  },

  /** Safety team only: move a report from open, to under review, to resolved. */
  advanceReport: (id: string) => act({ action: "advanceReport", reportId: id }),

  leaveReview: (tradeId: string, rating: Review["rating"], comment: string) =>
    act({ action: "review", tradeId, rating, comment }),
};

export { REPORT_CATEGORY_LABELS } from "./trade-logic";

/* ------------------------- selector helpers ------------------------- */

export const findCollector = (s: MarketState, id: string | null | undefined) =>
  s.collectors.find((c) => c.id === id);
export const findCollectorByUsername = (s: MarketState, u: string) =>
  s.collectors.find((c) => c.username === u);

/** Completed-trade counts are kept on each profile by the server. */
export function reputationFor(s: MarketState, collectorId: string) {
  const c = findCollector(s, collectorId);
  if (!c) return null;
  return logic.computeReputation(c, s.reviews);
}

/** The signed-in collector profile, or undefined when the visitor isn't logged in. */
export function useMe(): Collector | undefined {
  const s = useMarket();
  return findCollector(s, s.currentUserId);
}
