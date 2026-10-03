import { describe, expect, it } from "vitest";
import { isSameStatementRow } from "./importDuplicateDetection";
import { detectTransferIds } from "./transferDetection";
import { validateImportPayload, MAX_IMPORT_ROWS } from "./importValidation";
import { validateSubscriptionFields } from "./subscriptionValidation";
import { safeInternalPath } from "./navigation";
import { initialsAvatarDataUri } from "./initialsAvatar";
import { calendarMonthsUtcHalfOpenRange, calendarDayInAppTimeZone, toAppDate } from "./date";
import { metricTransactions, netBalanceChange } from "./metricsFilters";
import { getAncestorIds, getSystemDescendantIds } from "./categoryTree";

describe("isSameStatementRow", () => {
  const base = { date: "2025-03-02T10:00:00Z", amount: 10, type: "expense", description: "Café" };

  it("reconoce la misma fila reexportada con la hora desplazada", () => {
    expect(isSameStatementRow({ ...base, date: "2025-03-02T12:14:44Z" }, base)).toBe(true);
  });

  it("con saldo de extracto en ambas, manda el saldo", () => {
    expect(
      isSameStatementRow({ ...base, description: "Coffee", statement_balance: 90 }, { ...base, statement_balance: 90 })
    ).toBe(true);
    expect(
      isSameStatementRow({ ...base, statement_balance: 90 }, { ...base, statement_balance: 80 })
    ).toBe(false);
  });

  it("una fila fusionada compara con la fecha y descripción del banco, no con las del usuario", () => {
    const merged = { ...base, date: "2025-03-02T10:00:00Z", description: "Mi café", booked_at: "2025-03-05T08:00:00Z", bank_description: "COMPRA CAFE 1234" };
    const incoming = { ...base, date: "2025-03-05T08:00:00Z", description: "COMPRA CAFE 1234" };
    expect(isSameStatementRow(incoming, merged)).toBe(true);
    // Sin booked_at manda la fecha del usuario (fila anterior a la migración).
    expect(isSameStatementRow(incoming, { ...merged, booked_at: null, bank_description: null })).toBe(false);
    expect(isSameStatementRow({ ...incoming, description: "Mi café" }, merged)).toBe(false);
  });

  it("no empareja fuera de la ventana, con otro importe u otro tipo", () => {
    expect(isSameStatementRow({ ...base, date: "2025-03-02T14:00:01Z" }, base)).toBe(false);
    expect(isSameStatementRow({ ...base, amount: 10.01 }, base)).toBe(false);
    expect(isSameStatementRow({ ...base, type: "income" }, base)).toBe(false);
  });
});

describe("detectTransferIds", () => {
  it("las filas de cuentas conjuntas nunca son contrapartida de un traspaso", () => {
    const rows = [
      { id: "out", type: "expense", amount: 50, date: "2026-10-01T10:00:00Z", account_id: "a1" },
      { id: "in", type: "income", amount: 50, date: "2026-10-01T11:00:00Z", account_id: "joint" },
    ];
    expect([...detectTransferIds(rows)].sort()).toEqual(["in", "out"]);
    expect(detectTransferIds(rows, 48, { jointAccountIds: ["joint"] }).size).toBe(0);
  });

  it("empareja gasto e ingreso del mismo importe en cuentas distintas y fechas cercanas", () => {
    const ids = detectTransferIds([
      { id: "e", amount: 100, type: "expense", date: "2025-03-01T10:00:00Z", account_id: "A" },
      { id: "i", amount: 100, type: "income", date: "2025-03-02T09:00:00Z", account_id: "B" },
      { id: "x", amount: 100, type: "income", date: "2025-03-01T10:00:00Z", account_id: "A" },
    ]);
    expect([...ids].sort()).toEqual(["e", "i"]);
  });

  it("ignora pares fuera de la ventana", () => {
    const ids = detectTransferIds([
      { id: "e", amount: 100, type: "expense", date: "2025-03-01T00:00:00Z", account_id: "A" },
      { id: "i", amount: 100, type: "income", date: "2025-03-04T00:00:00Z", account_id: "B" },
    ]);
    expect(ids.size).toBe(0);
  });
});

describe("validateImportPayload", () => {
  const valid = {
    date: "2025-03-01",
    amount: 12.5,
    type: "expense",
    description: "Café",
    external_hash: "a".repeat(64),
    import_source_fingerprint: "fp|occ:0",
  };

  it("acepta un payload correcto", () => {
    expect(validateImportPayload([valid], 100)).toBeNull();
    expect(validateImportPayload([valid], null)).toBeNull();
  });

  it("rechaza tipos, importes, fechas y saldos inválidos", () => {
    expect(validateImportPayload([], undefined)).not.toBeNull();
    expect(validateImportPayload([{ ...valid, type: "transfer" }], undefined)).toBe("invalid_transaction_type");
    expect(validateImportPayload([{ ...valid, amount: -1 }], undefined)).toBe("invalid_transaction_amount");
    expect(validateImportPayload([{ ...valid, date: "nope" }], undefined)).toBe("invalid_transaction_date");
    expect(validateImportPayload([valid], "100")).toBe("invalid_final_balance");
    expect(validateImportPayload([{ ...valid, external_hash: "x" }], undefined)).toBe("invalid_transaction_hash");
  });

  it("limita el tamaño del lote", () => {
    expect(validateImportPayload(Array(MAX_IMPORT_ROWS + 1).fill(valid), undefined)).toBe("too_many_transactions");
  });
});

describe("validateSubscriptionFields", () => {
  it("rechaza frecuencias que colgarían el cálculo de fechas", () => {
    expect(validateSubscriptionFields({ frequency_value: 0 })).toBe("invalid_frequency_value");
    expect(validateSubscriptionFields({ frequency_value: -2 })).toBe("invalid_frequency_value");
    expect(validateSubscriptionFields({ frequency: "daily" })).toBe("invalid_frequency");
    expect(validateSubscriptionFields({ cost: -5 })).toBe("invalid_cost");
  });

  it("acepta valores correctos y campos ausentes", () => {
    expect(
      validateSubscriptionFields({ cost: 9.99, frequency: "monthly", frequency_value: 1, start_date: "2025-01-31", end_date: null })
    ).toBeNull();
    expect(validateSubscriptionFields({})).toBeNull();
  });
});

describe("safeInternalPath", () => {
  it("solo permite rutas internas", () => {
    expect(safeInternalPath("/transactions?x=1")).toBe("/transactions?x=1");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
    expect(safeInternalPath("@evil.com")).toBe("/");
    expect(safeInternalPath("https://evil.com", "/home")).toBe("/home");
    expect(safeInternalPath(null)).toBe("/");
  });
});

describe("initialsAvatarDataUri", () => {
  it("genera un SVG local con iniciales escapadas", () => {
    const uri = initialsAvatarDataUri("<b> Netflix");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    const svg = decodeURIComponent(uri.split(",")[1]!);
    expect(svg).toContain("&#60;N");
    expect(svg).not.toContain("<b>");
  });
});

describe("fechas en hora de Madrid", () => {
  it("el rango de mes cubre desde la medianoche de Madrid", () => {
    expect(calendarMonthsUtcHalfOpenRange(2025, 7, 2025, 7)).toEqual({
      startIso: "2025-06-30T22:00:00.000Z",
      endExclusiveIso: "2025-07-31T22:00:00.000Z",
    });
  });

  it("agrupa por el día de Madrid aunque el navegador esté en otra zona", () => {
    // 23:30 UTC del 31 de julio = 1 de agosto en Madrid.
    expect(calendarDayInAppTimeZone("2025-07-31T23:30:00Z")).toBe("2025-08-01");
    const d = toAppDate("2025-07-31T23:30:00Z");
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2025, 8, 1, 1]);
  });
});

describe("categorías y métricas", () => {
  const categories = [
    { id: "food", parent_id: null, user_id: null },
    { id: "food-super", parent_id: "food", user_id: null },
    { id: "food-super-bio", parent_id: "food-super", user_id: null },
    { id: "custom", parent_id: "food", user_id: "u1" },
  ];

  it("árbol de categorías del sistema", () => {
    expect(getSystemDescendantIds(categories, "food")).toEqual(["food-super", "food-super-bio"]);
    expect(getAncestorIds(categories, "food-super-bio")).toEqual(["food-super", "food"]);
  });

  it("metricTransactions excluye categorías marcadas y sus subcategorías", () => {
    const ctx = {
      defaultCategories: [
        {
          id: "transfers",
          name: "Traspasos",
          isDefault: true,
          exclude_from_metrics: true,
          subcategories: [{ id: "transfers-sub", name: "Sub", isDefault: true }],
        },
      ],
      userCategories: [],
    };
    const tx = (id: string, amount: number, categories: { category_id?: string; subcategory_id?: string }) => ({
      id,
      amount,
      type: "expense",
      date: "2025-03-01T10:00:00Z",
      account_id: "A",
      ...categories,
    });
    const txs = [
      tx("1", 1, { category_id: "transfers" }),
      tx("2", 2, { subcategory_id: "transfers-sub" }),
      tx("3", 3, { category_id: "food" }),
      tx("4", 4, {}),
    ];
    expect(metricTransactions(txs, ctx).map((t) => t.id)).toEqual(["3", "4"]);
  });

  it("netBalanceChange suma ingresos y resta gastos", () => {
    expect(netBalanceChange([{ amount: 100, type: "income" }, { amount: "30.5", type: "expense" }])).toBe(69.5);
  });
});
