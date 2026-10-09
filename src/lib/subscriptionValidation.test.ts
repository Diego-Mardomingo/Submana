import { describe, expect, it } from "vitest";
import { isReminderOffsets, normalizeReminderOffsets, parseReminderOffsetsInput, validateSubscriptionFields } from "./subscriptionValidation";

describe("reminder_offsets", () => {
  it("accepts any subset of 0, 1, 3 and 7, including none", () => {
    expect(isReminderOffsets([])).toBe(true);
    expect(isReminderOffsets([0, 1, 3, 7])).toBe(true);
    expect(validateSubscriptionFields({ reminder_offsets: [7, 1] })).toBeNull();
  });

  it("rejects other values and shapes", () => {
    expect(isReminderOffsets([2])).toBe(false);
    expect(isReminderOffsets([-1])).toBe(false);
    expect(isReminderOffsets(["1"])).toBe(false);
    expect(isReminderOffsets(1)).toBe(false);
    expect(validateSubscriptionFields({ reminder_offsets: [30] })).toBe("invalid_reminder_offsets");
    expect(validateSubscriptionFields({ reminder_offsets: null })).toBe("invalid_reminder_offsets");
  });

  it("does not require the field", () => {
    expect(validateSubscriptionFields({ cost: 5 })).toBeNull();
  });

  it("dedupes and sorts", () => {
    expect(normalizeReminderOffsets([7, 1, 1, 0, 3, 3])).toEqual([0, 1, 3, 7]);
    expect(normalizeReminderOffsets([])).toEqual([]);
  });

  it("reads the stringified form the create route receives", () => {
    expect(parseReminderOffsetsInput("1,3")).toEqual([1, 3]);
    expect(parseReminderOffsetsInput("")).toEqual([]);
    expect(parseReminderOffsetsInput(undefined)).toBeUndefined();
    expect(parseReminderOffsetsInput([0])).toEqual([0]);
    expect(isReminderOffsets(parseReminderOffsetsInput("1,x"))).toBe(false);
    expect(isReminderOffsets(parseReminderOffsetsInput("1,,3"))).toBe(false);
  });
});
