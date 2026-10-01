import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv";
import { parseCellNumber, parseEuropeanNumber, parseDate, toImportedTransactions } from "./utils";
import { findFinalBalance } from "./bbva";
import { parseExcelDate } from "./revolut";
import { pickYearForPartialDate } from "./tradeRepublic";
import { buildDuplicateConflictKey, buildDuplicateConflictKeyLegacy } from "./importKeys";

describe("parseCSV", () => {
  it("separa celdas y recorta espacios", () => {
    expect(parseCSV("a, b ,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeta comillas, comillas escapadas y saltos de línea dentro de campos", () => {
    const csv = 'desc,amount\n"Pago, ""tienda""",-1.5\n"línea\nnueva",2\r\n';
    expect(parseCSV(csv)).toEqual([
      ["desc", "amount"],
      ['Pago, "tienda"', "-1.5"],
      ["línea\nnueva", "2"],
    ]);
  });

  it("admite otro delimitador, ignora BOM y filas vacías", () => {
    expect(parseCSV("﻿concepto;importe\n\n;;\nCafé;-2,50EUR", ";")).toEqual([
      ["concepto", "importe"],
      ["Café", "-2,50EUR"],
    ]);
  });
});

describe("números", () => {
  it("parseEuropeanNumber entiende miles y decimales españoles", () => {
    expect(parseEuropeanNumber("1.234,56 €")).toBe(1234.56);
    expect(parseEuropeanNumber("-12,50")).toBe(-12.5);
  });

  it("parseCellNumber no trunca importes con separador de miles", () => {
    expect(parseCellNumber("1.234,56")).toBe(1234.56);
    expect(parseCellNumber(-45.2)).toBe(-45.2);
    expect(parseCellNumber("-12.50")).toBe(-12.5);
    expect(parseCellNumber("")).toBe(0);
  });
});

describe("findFinalBalance (BBVA)", () => {
  const tx = (fecha: string, importe: number, disponible: number) => ({
    fechaValor: fecha,
    fecha,
    concepto: "",
    movimiento: "",
    importe,
    disponible,
  });

  it("elige el último movimiento del último día sin depender del orden del fichero", () => {
    // Saldo 100 → -20 (80) → +50 (130) el mismo día.
    const rows = [tx("2025-03-01", -10, 100), tx("2025-03-02", -20, 80), tx("2025-03-02", 50, 130)];
    expect(findFinalBalance(rows)).toBe(130);
    expect(findFinalBalance([...rows].reverse())).toBe(130);
  });

  it("devuelve undefined sin movimientos", () => {
    expect(findFinalBalance([])).toBeUndefined();
  });
});

describe("parseExcelDate (Revolut)", () => {
  it("convierte el serial Excel a la hora de pared exacta, sin desfase de zona", () => {
    expect(parseExcelDate(String(45853 + (9 * 60 + 30) / 1440))).toBe("2025-07-15 09:30:00");
    // Antes: 23:50 se convertía en el día siguiente a las 02:04.
    expect(parseExcelDate(String(45853 + (23 * 60 + 50) / 1440))).toBe("2025-07-15 23:50:00");
  });

  it("deja intactos los valores que no son seriales", () => {
    expect(parseExcelDate("2025-07-15 09:30:00")).toBe("2025-07-15 09:30:00");
  });
});

describe("parseDate / pickYearForPartialDate (Trade Republic)", () => {
  it("parsea formatos con mes en texto y numéricos", () => {
    expect(parseDate("15 dic 2025")).toBe("2025-12-15");
    expect(parseDate("03.01.2026")).toBe("2026-01-03");
  });

  it("asigna el año correcto en extractos que cruzan diciembre → enero", () => {
    const period = ["2025-12-01", "2026-01-31"];
    expect(pickYearForPartialDate("15 dic", period, "2025")).toBe("2025");
    expect(pickYearForPartialDate("10 ene", period, "2025")).toBe("2026");
  });

  it("usa el año de respaldo si no hay periodo", () => {
    expect(pickYearForPartialDate("10 ene", [], "2024")).toBe("2024");
  });
});

describe("importKeys", () => {
  it("numera ocurrencias de huellas idénticas", async () => {
    const row = (fingerprint: string) => ({ date: "2025-03-02", signedAmount: -1, description: "x", fingerprint });
    const txs = await toImportedTransactions("acc", ["a", "b", "a", "a"].map(row));
    expect(txs.map((t) => t.import_source_fingerprint)).toEqual(["a|occ:0", "b|occ:0", "a|occ:1", "a|occ:2"]);
  });

  it("la clave de conflicto depende de día, céntimos y tipo", async () => {
    const base = await buildDuplicateConflictKey("acc", "2025-03-02", 10.5, "expense");
    expect(await buildDuplicateConflictKey("acc", "2025-03-02", 10.5, "EXPENSE")).toBe(base);
    expect(await buildDuplicateConflictKey("acc", "2025-03-02", 10.5, "income")).not.toBe(base);
    expect(await buildDuplicateConflictKeyLegacy("acc", "2025-03-02", 10.5)).not.toBe(base);
  });
});
