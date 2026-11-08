import { describe, expect, it } from "vitest";
import { createSampleState } from "@/test/fixtures/sample-market";
import {
  ActionError,
  applyTradeStep,
  buildProposal,
  buildReview,
  markCompleteIfDone,
  parseRequest,
} from "./trade-actions";
import { PACKING_CHECKLIST, itemsSentBy } from "./trade-logic";
import type { Listing, Trade } from "./types";

const AT = "2026-11-07T00:00:00.000Z";
const pending = (): Trade => createSampleState().trades.find((t) => t.id === "t-1001")!; // u-ash proposes to u-me
const PROPOSER = "u-ash";
const RECEIVER = "u-me";
const step = (t: Trade, who: string, req: Record<string, unknown>) =>
  applyTradeStep(t, who, { tradeId: t.id, ...req } as never, AT, "MT-TEST");

function runToInspection(): Trade {
  let t = step(pending(), RECEIVER, { action: "accept" });
  t = step(t, PROPOSER, { action: "sign" });
  t = step(t, RECEIVER, { action: "sign" });
  for (const who of [PROPOSER, RECEIVER]) {
    t = step(t, who, { action: "label", checklist: [...PACKING_CHECKLIST] });
    t = step(t, who, { action: "dropOff" });
  }
  for (const who of [PROPOSER, RECEIVER]) {
    for (let i = 0; i < 3; i++) t = step(t, who, { action: "carrierScan" });
  }
  return t;
}

describe("who can act on a trade", () => {
  it("a stranger can't do anything to someone else's trade", () => {
    const err = (() => {
      try {
        step(pending(), "u-stranger", { action: "accept" });
      } catch (e) {
        return e;
      }
      return undefined;
    })();
    expect(err).toBeInstanceOf(ActionError);
    expect((err as ActionError).status).toBe(403);
  });

  it("only the receiver can accept, only the proposer can withdraw", () => {
    expect(() => step(pending(), PROPOSER, { action: "accept" })).toThrow();
    expect(() => step(pending(), RECEIVER, { action: "withdraw" })).toThrow();
    expect(step(pending(), RECEIVER, { action: "accept" }).status).toBe("accepted");
  });

  it("signing only ever signs your own side", () => {
    let t = step(pending(), RECEIVER, { action: "accept" });
    t = step(t, PROPOSER, { action: "sign" });
    expect(t.agreement?.signatures.proposer).toBeDefined();
    expect(t.agreement?.signatures.receiver).toBeUndefined();
    expect(() => step(t, PROPOSER, { action: "sign" })).toThrow(/Already signed/);
  });

  it("each collector ships only their own package", () => {
    let t = step(pending(), RECEIVER, { action: "accept" });
    t = step(t, PROPOSER, { action: "sign" });
    t = step(t, RECEIVER, { action: "sign" });
    t = step(t, PROPOSER, { action: "label", checklist: [...PACKING_CHECKLIST] });
    expect(t.shipments.proposer.stage).toBe("label_created");
    expect(t.shipments.receiver.stage).toBe("packing");
  });

  it("you confirm and inspect the package you RECEIVED, not the one you sent", () => {
    let t = runToInspection();
    t = step(t, RECEIVER, { action: "confirmDelivery" });
    expect(t.shipments.proposer.deliveryConfirmedAt).toBeDefined();
    expect(t.shipments.receiver.deliveryConfirmedAt).toBeUndefined();
  });

  it("a full trade completes only after both inspections, then each side can review once", () => {
    let t = runToInspection();
    for (const who of [PROPOSER, RECEIVER]) t = step(t, who, { action: "confirmDelivery" });
    t = step(t, RECEIVER, {
      action: "inspect",
      result: "approved",
      checkedAccessories: itemsSentBy(t, "proposer").flatMap((i) => i.accessories),
      notes: "",
    });
    expect(markCompleteIfDone(t, [], AT)).toBeNull();
    t = step(t, PROPOSER, {
      action: "inspect",
      result: "approved",
      checkedAccessories: itemsSentBy(t, "receiver").flatMap((i) => i.accessories),
      notes: "",
    });
    const done = markCompleteIfDone(t, [], AT)!;
    expect(done).not.toBeNull();
    expect(markCompleteIfDone(done, [], AT)).toBeNull();

    const { review, trade } = buildReview(done, RECEIVER, [], 5, "Great trade", AT);
    expect(review.collectorId).toBe(PROPOSER);
    expect(() => buildReview(trade, RECEIVER, [], 5, "again", AT)).toThrow(/already reviewed/);
    expect(() => buildReview(trade, "u-stranger", [], 5, "", AT)).toThrow();
  });

  it("can't review before the trade is complete", () => {
    expect(() => buildReview(pending(), RECEIVER, [], 5, "", AT)).toThrow(
      /once the trade is complete/,
    );
  });
});

describe("making an offer", () => {
  const listing = (id: string, ownerId: string, status: Listing["status"] = "active"): Listing => ({
    ...createSampleState().listings[0]!,
    id,
    ownerId,
    status,
  });
  const base = { id: "t-new", proposerId: "a", receiverId: "b", message: "", at: AT };

  it("works when each side offers their own active figures", () => {
    const t = buildProposal({
      ...base,
      offered: [listing("l1", "a")],
      requested: [listing("l2", "b")],
      offeredIds: ["l1"],
      requestedIds: ["l2"],
    });
    expect(t.status).toBe("pending");
    expect(t.proposerItems[0]?.listingId).toBe("l1");
  });

  it("rejects offering someone else's figure as your own", () => {
    expect(() =>
      buildProposal({
        ...base,
        offered: [listing("l1", "c")],
        requested: [listing("l2", "b")],
        offeredIds: ["l1"],
        requestedIds: ["l2"],
      }),
    ).toThrow(/your figures/);
  });

  it("rejects figures that are paused or already in a trade", () => {
    expect(() =>
      buildProposal({
        ...base,
        offered: [listing("l1", "a")],
        requested: [listing("l2", "b", "in_trade")],
        offeredIds: ["l1"],
        requestedIds: ["l2"],
      }),
    ).toThrow(/isn't available/);
  });

  it("rejects trading with yourself", () => {
    expect(() =>
      buildProposal({
        ...base,
        receiverId: "a",
        offered: [],
        requested: [],
        offeredIds: ["x"],
        requestedIds: ["y"],
      }),
    ).toThrow(/yourself/);
  });
});

describe("request parsing", () => {
  it("rejects unknown actions and junk", () => {
    expect(() => parseRequest(null)).toThrow();
    expect(() => parseRequest({ action: "deleteEverything" })).toThrow(/Unknown action/);
  });

  it("rejects ratings outside 1 to 5", () => {
    expect(() => parseRequest({ action: "review", tradeId: "t-1", rating: 9 })).toThrow();
  });

  it("caps long text instead of storing it", () => {
    const r = parseRequest({
      action: "propose",
      receiverId: "b",
      offeredListingIds: ["1"],
      requestedListingIds: ["2"],
      message: "x".repeat(5000),
    });
    expect(r.action === "propose" && r.message.length).toBe(1000);
  });
});
