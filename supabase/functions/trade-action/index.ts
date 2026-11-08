// MOTIONTRADES trade-action edge function.
//
// Every trade, review and report write goes through here. It:
//   1. checks who is calling (their login token),
//   2. loads the current trade from the database,
//   3. runs the shared, unit-tested rules (../_shared/trade-actions.ts),
//   4. saves the result only if nobody changed the trade in the meantime.
//
// The files in ../_shared are copied from src/lib/marketplace by `npm run sync:edge`.
// Edit the originals in src/, never the copies.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  ActionError,
  advanceReportState,
  applyTradeStep,
  buildProposal,
  buildReview,
  isTradeStep,
  markCompleteIfDone,
  newTrackingCode,
  newTradeId,
  noteReportOnTrade,
  parseRequest,
  resolveTradeAfterReport,
  tradeListingIds,
} from "../_shared/trade-actions.ts";
import { rowToListing, rowToReport, type ListingRow, type ReportRow } from "../_shared/rows.ts";
import type { Report, Trade } from "../_shared/types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secrets ? JSON.parse(secrets)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadTrade(db: SupabaseClient, id: string): Promise<{ trade: Trade; updatedAt: string }> {
  const { data, error } = await db.from("trades").select("doc, updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError("Trade not found", 404);
  return { trade: data.doc as Trade, updatedAt: data.updated_at as string };
}

async function tradeReports(db: SupabaseClient, tradeId: string): Promise<Report[]> {
  const { data, error } = await db.from("reports").select("*").eq("target_type", "trade").eq("target_id", tradeId);
  if (error) throw error;
  return (data as ReportRow[]).map(rowToReport);
}

/** Save only if the row is unchanged since we read it (two people clicking at once). */
async function saveTrade(db: SupabaseClient, trade: Trade, expectedUpdatedAt: string) {
  const { data, error } = await db
    .from("trades")
    .update({ doc: trade, status: trade.status, updated_at: trade.updatedAt })
    .eq("id", trade.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new ActionError("This trade just changed. Refresh and try again.", 409);
}

async function setListingStatus(db: SupabaseClient, ids: string[], status: string) {
  if (!ids.length) return;
  const { error } = await db.from("listings").update({ status }).in("id", ids);
  if (error) throw error;
}

/** After any change: if the trade just finished, close it out. */
async function finishIfComplete(db: SupabaseClient, trade: Trade, savedUpdatedAt: string, at: string) {
  const done = markCompleteIfDone(trade, await tradeReports(db, trade.id), at);
  if (!done) return;
  await saveTrade(db, done, savedUpdatedAt);
  await setListingStatus(db, tradeListingIds(done), "traded");
  const { error } = await db.rpc("record_completed_trade", { a: done.proposerId, b: done.receiverId });
  if (error) throw error;
}

async function handle(req: Request): Promise<Response> {
  const db = adminClient();

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const me = auth.user?.id;
  if (!me) throw new ActionError("Log in to do that", 403);

  const body = parseRequest(await req.json().catch(() => null));
  const at = new Date().toISOString();

  if (isTradeStep(body)) {
    const { trade, updatedAt } = await loadTrade(db, body.tradeId);
    const next = applyTradeStep(trade, me, body, at, newTrackingCode());

    if (body.action === "accept") {
      // Both sides' figures must still be available when the offer is accepted.
      const ids = tradeListingIds(trade);
      const { data, error } = await db.from("listings").select("id, status").in("id", ids);
      if (error) throw error;
      const unavailable = ids.filter((id) => data.find((l) => l.id === id)?.status !== "active");
      if (unavailable.length) throw new ActionError("One of these figures isn't available anymore", 409);
    }

    await saveTrade(db, next, updatedAt);
    if (body.action === "accept") await setListingStatus(db, tradeListingIds(next), "in_trade");
    if (body.action === "inspect") await finishIfComplete(db, next, next.updatedAt, at);
    return json({ ok: true, tradeId: next.id });
  }

  switch (body.action) {
    case "propose": {
      const ids = [...body.offeredListingIds, ...body.requestedListingIds];
      const { data, error } = await db.from("listings").select("*").in("id", ids);
      if (error) throw error;
      const listings = (data as ListingRow[]).map(rowToListing);
      const trade = buildProposal({
        id: newTradeId(),
        proposerId: me,
        receiverId: body.receiverId,
        offered: listings,
        requested: listings,
        offeredIds: body.offeredListingIds,
        requestedIds: body.requestedListingIds,
        message: body.message,
        at,
      });
      const { error: insertError } = await db.from("trades").insert({
        id: trade.id,
        proposer_id: trade.proposerId,
        receiver_id: trade.receiverId,
        status: trade.status,
        doc: trade,
        created_at: at,
        updated_at: at,
      });
      if (insertError) throw insertError;
      return json({ ok: true, tradeId: trade.id });
    }

    case "review": {
      const { trade, updatedAt } = await loadTrade(db, body.tradeId);
      const { review, trade: next } = buildReview(trade, me, await tradeReports(db, trade.id), body.rating, body.comment, at);
      const { error } = await db.from("reviews").insert({
        collector_id: review.collectorId,
        author_id: review.authorId,
        trade_id: review.tradeId,
        rating: review.rating,
        comment: review.comment,
        created_at: at,
      });
      if (error) throw error;
      await saveTrade(db, next, updatedAt);
      return json({ ok: true });
    }

    case "report": {
      let tradeToNote: { trade: Trade; updatedAt: string } | null = null;
      if (body.targetType === "trade") {
        tradeToNote = await loadTrade(db, body.targetId);
        noteReportOnTrade(tradeToNote.trade, me, body.category, at); // throws if not part of the trade
      }
      const { data, error } = await db
        .from("reports")
        .insert({
          reporter_id: me,
          target_type: body.targetType,
          target_id: body.targetId,
          category: body.category,
          description: body.description,
          desired_resolution: body.desiredResolution,
          status: "open",
          updates: [{ at, message: "Report received. Both collectors were notified." }],
          created_at: at,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (tradeToNote) {
        await saveTrade(db, noteReportOnTrade(tradeToNote.trade, me, body.category, at), tradeToNote.updatedAt);
      }
      return json({ ok: true, reportId: data.id });
    }

    case "advanceReport": {
      const { data: profile } = await db.from("profiles").select("is_admin").eq("id", me).maybeSingle();
      if (!profile?.is_admin) throw new ActionError("Only the safety team can do that", 403);
      const { data: row, error } = await db.from("reports").select("*").eq("id", body.reportId).maybeSingle();
      if (error) throw error;
      if (!row) throw new ActionError("Report not found", 404);
      const next = advanceReportState(rowToReport(row as ReportRow), at);
      const { error: upErr } = await db
        .from("reports")
        .update({ status: next.status, updates: next.updates })
        .eq("id", next.id);
      if (upErr) throw upErr;
      if (next.status === "resolved" && next.targetType === "trade") {
        const { trade, updatedAt } = await loadTrade(db, next.targetId);
        const resolved = resolveTradeAfterReport(trade, at);
        await saveTrade(db, resolved, updatedAt);
        await finishIfComplete(db, resolved, resolved.updatedAt, at);
      }
      return json({ ok: true });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on our end. Try again." }, 500);
  }
});
