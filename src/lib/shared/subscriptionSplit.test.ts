import { describe, expect, it } from "vitest";
import { myShareCents, parseSharedSplit, subscriptionShares } from "./subscriptionSplit";

const me = "00000000-0000-4000-8000-000000000001";
const laura = "00000000-0000-4000-8000-000000000002";
const marcos = "00000000-0000-4000-8000-000000000003";
const ana = "00000000-0000-4000-8000-000000000004";
const all = [me, laura, marcos, ana];
const cents = (shares: { userId: string; cents: number }[] | null) => Object.fromEntries((shares ?? []).map((s) => [s.userId, s.cents]));

describe("parseSharedSplit", () => {
  it("accepts the modes of a group expense", () => {
    expect(parseSharedSplit({ mode: "equal", participants: [{ user_id: me, value: 3 }, { user_id: laura }] })).toEqual({ mode: "equal", participants: [{ user_id: me }, { user_id: laura }] });
    expect(parseSharedSplit({ mode: "percent", participants: [{ user_id: me, value: 60 }, { user_id: laura, value: "40" }] })?.participants[1]).toEqual({ user_id: laura, value: 40 });
  });
  it("rejects junk", () => {
    expect(parseSharedSplit(null)).toBeNull();
    expect(parseSharedSplit({ mode: "weird", participants: [{ user_id: me }] })).toBeNull();
    expect(parseSharedSplit({ mode: "equal", participants: [] })).toBeNull();
    expect(parseSharedSplit({ mode: "equal", participants: [{ user_id: me }, { user_id: me }] })).toBeNull();
    expect(parseSharedSplit({ mode: "exact", participants: [{ user_id: me }] })).toBeNull();
    expect(parseSharedSplit({ mode: "equal", participants: [{ user_id: "x" }] })).toBeNull();
  });
});

describe("subscriptionShares", () => {
  it("Spotify Familiar 17,99 € in four: leftover cents go payer first", () => {
    const split = { mode: "equal" as const, participants: all.map((user_id) => ({ user_id })) };
    expect(cents(subscriptionShares(split, all, 1799, me))).toEqual({ [me]: 450, [laura]: 450, [marcos]: 450, [ana]: 449 });
    expect(myShareCents(split, all, 1799, me, laura)).toBe(450);
  });
  it("someone who left the group is dropped; the rest share it", () => {
    const split = { mode: "equal" as const, participants: all.map((user_id) => ({ user_id })) };
    expect(cents(subscriptionShares(split, [me, laura, marcos], 1800, me))).toEqual({ [me]: 600, [laura]: 600, [marcos]: 600 });
  });
  it("nobody left of the split: the whole group, equally", () => {
    const split = { mode: "shares" as const, participants: [{ user_id: ana, value: 2 }] };
    expect(cents(subscriptionShares(split, [me, laura], 1000, me))).toEqual({ [me]: 500, [laura]: 500 });
  });
  it("exact amounts that no longer add up (new price) are scaled", () => {
    const split = { mode: "exact" as const, participants: [{ user_id: me, value: 10 }, { user_id: laura, value: 5 }] };
    expect(cents(subscriptionShares(split, all, 1500, me))).toEqual({ [me]: 1000, [laura]: 500 });
    expect(cents(subscriptionShares(split, all, 1800, me))).toEqual({ [me]: 1200, [laura]: 600 });
  });
  it("percent and shares split proportionally", () => {
    expect(cents(subscriptionShares({ mode: "percent", participants: [{ user_id: me, value: 75 }, { user_id: laura, value: 25 }] }, all, 1000, me))).toEqual({ [me]: 750, [laura]: 250 });
    expect(cents(subscriptionShares({ mode: "shares", participants: [{ user_id: me, value: 1 }, { user_id: laura, value: 2 }] }, all, 900, me))).toEqual({ [me]: 300, [laura]: 600 });
  });
  it("a share of me that I'm not part of is 0", () => {
    expect(myShareCents({ mode: "equal", participants: [{ user_id: laura }] }, all, 1000, me, me)).toBe(0);
  });
});
