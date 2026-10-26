import { describe, expect, it } from "vitest";
import { activePhase, tierStatus, type TicketTier } from "./pricing";

const tier: TicketTier = {
  id: "t",
  name: "Regular",
  phases: [
    { label: "Early Bird", price: 1000, startsAt: "2026-01-01T00:00:00Z" },
    { label: "Advance", price: 1500, startsAt: "2026-02-01T00:00:00Z" },
  ],
  salesEndAt: "2026-03-01T00:00:00Z",
  quantity: 10,
  sold: 0,
};

describe("ticket pricing", () => {
  it("rewrites price automatically when the next phase starts", () => {
    expect(activePhase(tier, new Date("2026-01-15"))?.price).toBe(1000);
    expect(activePhase(tier, new Date("2026-02-02"))?.price).toBe(1500);
  });
  it("expires tickets after the sales end time", () => {
    expect(tierStatus(tier, new Date("2026-03-02"))).toBe("expired");
  });
  it("is upcoming before the first phase", () => {
    expect(tierStatus(tier, new Date("2025-12-01"))).toBe("upcoming");
  });
  it("is sold out when quantity is reached", () => {
    expect(tierStatus({ ...tier, sold: 10 }, new Date("2026-01-15"))).toBe("sold-out");
  });
});
