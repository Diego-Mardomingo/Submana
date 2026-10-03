import { describe, expect, it } from "vitest";
import { canEditAccount } from "./accountAccess";

describe("canEditAccount", () => {
  it("el propietario puede editarlo todo", () => {
    for (const field of ["name", "balance", "is_default", "display_order", "is_joint", "members", "delete", "bulk_delete"] as const) {
      expect(canEditAccount("owner", field)).toBe(true);
    }
  });

  it("un miembro solo edita presentación y saldo", () => {
    for (const field of ["name", "color", "icon", "bank_provider", "balance"] as const) expect(canEditAccount("member", field)).toBe(true);
    for (const field of ["is_default", "display_order", "is_joint", "members", "delete", "bulk_delete"] as const) {
      expect(canEditAccount("member", field)).toBe(false);
    }
  });

  it("sin rol no se edita nada", () => {
    expect(canEditAccount(null, "name")).toBe(false);
    expect(canEditAccount(undefined, "balance")).toBe(false);
  });
});
