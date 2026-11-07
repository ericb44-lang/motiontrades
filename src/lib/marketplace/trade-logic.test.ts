import { describe, expect, it } from "vitest";
import { createSampleState } from "@/test/fixtures/sample-market";
import {
  PACKING_CHECKLIST,
  acceptOffer,
  advanceCarrier,
  computeReputation,
  confirmDelivery,
  generateLabel,
  getNextAction,
  getTradePhase,
  markDroppedOff,
  signAgreement,
  submitInspection,
} from "./trade-logic";
import type { Collector, Trade } from "./types";

const AT = "2026-11-07T00:00:00.000Z";
const seed = () => createSampleState();
const pending = (): Trade => seed().trades.find((t) => t.id === "t-1001")!; // u-ash -> u-me

function signedTrade() {
  let t = acceptOffer(pending(), "u-me", AT);
  t = signAgreement(t, "proposer", AT);
  return signAgreement(t, "receiver", AT);
}

function shipBoth(t: Trade) {
  for (const side of ["proposer", "receiver"] as const) {
    t = generateLabel(t, side, [...PACKING_CHECKLIST], AT, `MT-SIM-${side}`);
    t = markDroppedOff(t, side, AT);
  }
  return t;
}

describe("offer rules", () => {
  it("only the receiving collector can accept an offer", () => {
    expect(() => acceptOffer(pending(), "u-ash", AT)).toThrow();
    expect(acceptOffer(pending(), "u-me", AT).status).toBe("accepted");
  });

  it("accepting generates a written agreement with no signatures yet", () => {
    const t = acceptOffer(pending(), "u-me", AT);
    expect(t.agreement?.signatures).toEqual({});
    expect(getTradePhase(t)).toBe("agreement");
  });
});

describe("agreement + shipping", () => {
  it("shipping opens only after both collectors sign", () => {
    let t = acceptOffer(pending(), "u-me", AT);
    t = signAgreement(t, "receiver", AT);
    expect(t.shipments.receiver.stage).toBe("awaiting_agreement");
    t = signAgreement(t, "proposer", AT);
    expect(t.shipments.receiver.stage).toBe("packing");
    expect(getTradePhase(t)).toBe("shipping");
  });

  it("a label requires every packing checklist item", () => {
    const t = signedTrade();
    expect(() => generateLabel(t, "receiver", PACKING_CHECKLIST.slice(0, 4), AT, "X")).toThrow();
  });

  it("carrier tracking stays locked until BOTH packages are dropped off", () => {
    let t = signedTrade();
    t = generateLabel(t, "receiver", [...PACKING_CHECKLIST], AT, "X");
    t = markDroppedOff(t, "receiver", AT);
    expect(() => advanceCarrier(t, "receiver", AT)).toThrow();
    t = shipBoth({ ...t, shipments: { ...t.shipments, receiver: { ...t.shipments.receiver, stage: "packing" } } });
    expect(getTradePhase(t)).toBe("in_transit");
    expect(advanceCarrier(t, "receiver", AT).shipments.receiver.stage).toBe("in_transit");
  });
});

describe("delivery + inspection", () => {
  function delivered() {
    let t = shipBoth(signedTrade());
    for (const side of ["proposer", "receiver"] as const) {
      for (let i = 0; i < 3; i++) t = advanceCarrier(t, side, AT);
    }
    return t;
  }

  it("both packages delivered moves the trade to inspection", () => {
    expect(getTradePhase(delivered())).toBe("inspection");
  });

  it("cannot approve without checking off every agreed accessory", () => {
    const t = confirmDelivery(delivered(), "proposer", AT);
    expect(() =>
      submitInspection(t, "proposer", { result: "approved", checkedAccessories: ["Ice axe"], notes: "", at: AT }),
    ).toThrow();
  });

  it("trade completes only when both inspections are approved", () => {
    let t = delivered();
    for (const side of ["proposer", "receiver"] as const) {
      t = confirmDelivery(t, side, AT);
      const acc = (side === "proposer" ? t.proposerItems : t.receiverItems).flatMap((i) => i.accessories);
      t = submitInspection(t, side, { result: "approved", checkedAccessories: acc, notes: "", at: AT });
      if (side === "proposer") expect(getTradePhase(t)).toBe("inspection");
    }
    expect(getTradePhase(t)).toBe("completed");
  });

  it("an open problem report marks the trade disputed", () => {
    const s = seed();
    const t = s.trades.find((x) => x.id === "t-1007")!;
    expect(getTradePhase(t, s.reports)).toBe("disputed");
  });
});

describe("next action", () => {
  it("tells the receiver to review an incoming offer and the proposer to wait", () => {
    expect(getNextAction(pending(), "u-me").actor).toBe("you");
    expect(getNextAction(pending(), "u-ash").actor).toBe("them");
  });

  it("asks you to confirm delivery when their package has arrived", () => {
    const s = seed();
    const t = s.trades.find((x) => x.id === "t-1004")!;
    expect(getNextAction(t, "u-me", s.reports)).toEqual({ actor: "you", label: "Confirm your package arrived" });
  });
});

describe("reputation", () => {
  const base: Collector = {
    id: "c",
    username: "c",
    displayName: "C",
    region: "",
    bio: "",
    joinedAt: AT,
    avatarHue: 0,
    favoriteLines: [],
    stats: { completedTrades: 40, disputes: 0, onTimeShipRate: 1 },
  };
  const five = { id: "r", collectorId: "c", authorId: "x", rating: 5 as const, comment: "", createdAt: AT };

  it("perfect record scores 100 and is Elite", () => {
    const rep = computeReputation(base, [five]);
    expect(rep.score).toBe(100);
    expect(rep.tier).toBe("Elite");
  });

  it("a collector with no trades is New", () => {
    const rep = computeReputation({ ...base, stats: { completedTrades: 0, disputes: 0, onTimeShipRate: 0 } }, []);
    expect(rep.tier).toBe("New");
  });

  it("disputes lower the score", () => {
    const clean = computeReputation(base, [five]).score;
    const disputed = computeReputation({ ...base, stats: { ...base.stats, disputes: 4 } }, [five]).score;
    expect(disputed).toBeLessThan(clean);
  });
});
