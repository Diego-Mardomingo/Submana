import { describe, expect, it } from "vitest";
import { heatLevels } from "./spendHeat";

describe("heatLevels", () => {
  it("leaves days without spending at 0", () => {
    expect(heatLevels([0, 0, 0])).toEqual([0, 0, 0]);
    expect(heatLevels([])).toEqual([]);
  });

  it("grades each day against the typical one", () => {
    // Typical day (median of the days with spending): 40.
    expect(heatLevels([10, 40, 40, 60, 120, 0])).toEqual([1, 2, 2, 3, 4, 0]);
  });

  it("keeps the other days visible next to a very large payment", () => {
    const levels = heatLevels([650, 20, 45, 30, 60]);
    expect(levels[0]).toBe(4);
    expect(levels.slice(1).every((level) => level >= 1 && level <= 3)).toBe(true);
  });
});
