import type { TradeRepublicCashTransaction, ParsedPDFResult } from "./types";

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ColumnBoundaries {
  datum: { start: number; end: number };
  typ: { start: number; end: number };
  beschreibung: { start: number; end: number };
  zahlungseingang: { start: number; end: number };
  zahlungsausgang: { start: number; end: number };
  saldo: { start: number; end: number };
  headerY: number;
}

interface Headers {
  DATUM: TextItem | null;
  TYP: TextItem | null;
  BESCHREIBUNG: TextItem | null;
  ZAHLUNGEN: TextItem | null;
  ZAHLUNGSEINGANG: TextItem | null;
  ZAHLUNGSAUSGANG: TextItem | null;
  SALDO: TextItem | null;
}

const FOOTER_BOTTOM_BAND = 120;

function groupTextItemsByLine(items: TextItem[], tolerance: number = 3): TextItem[][] {
  if (items.length === 0) return [];
  
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - sorted[i - 1].y) <= tolerance) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [sorted[i]];
    }
  }
  lines.push(currentLine.sort((a, b) => a.x - b.x));
  
  return lines;
}

function findCashHeaders(items: TextItem[]): Headers | null {
  const lines = groupTextItemsByLine(items);
  
  let headerLine: TextItem[] | null = null;
  let headerY = 0;
  
  for (const line of lines) {
    const lineText = line.map(item => item.text.trim()).join(" ").toUpperCase();
    
    const hasDate = lineText.includes("FECHA") || lineText.includes("DATUM") || lineText.includes("DATE") || lineText.includes("DATA");
    const hasType = lineText.includes("TIPO") || lineText.includes("TYP") || lineText.includes("TYPE");
    const hasDesc = lineText.includes("DESCRIPCIÓN") || lineText.includes("BESCHREIBUNG") || lineText.includes("DESCRIPTION") || lineText.includes("DESCRIZIONE");
    const hasBalance = lineText.includes("BALANCE") || lineText.includes("SALDO");
    
    if (hasDate && hasDesc && hasBalance) {
      headerLine = line;
      headerY = line[0]?.y || 0;
      break;
    }
  }
  
  if (!headerLine) {
    return null;
  }
  
  const findItemContaining = (keywords: string[]): TextItem | null => {
    for (const item of headerLine!) {
      const t = item.text.trim().toUpperCase();
      if (keywords.some(kw => t.includes(kw.toUpperCase()))) {
        return item;
      }
    }
    return null;
  };
  
  const findItemStartingWith = (keywords: string[]): TextItem | null => {
    for (const item of headerLine!) {
      const t = item.text.trim().toUpperCase();
      if (keywords.some(kw => t.startsWith(kw.toUpperCase()))) {
        return item;
      }
    }
    return null;
  };

  const headers: Headers = {
    DATUM: findItemContaining(["FECHA", "DATUM", "DATE", "DATA"]),
    TYP: findItemContaining(["TIPO", "TYP", "TYPE"]),
    BESCHREIBUNG: findItemContaining(["DESCRIPCIÓN", "DESCRIPCION", "BESCHREIBUNG", "DESCRIPTION", "DESCRIZIONE"]),
    ZAHLUNGEN: null,
    ZAHLUNGSEINGANG: findItemStartingWith(["ENTRADA", "ZAHLUNGSEINGANG", "MONEY IN", "IN ENTRATA"]),
    ZAHLUNGSAUSGANG: findItemStartingWith(["SALIDA", "ZAHLUNGSAUSGANG", "MONEY OUT", "IN USCITA"]),
    SALDO: findItemContaining(["BALANCE", "SALDO"]),
  };
  
  if (!headers.DATUM || !headers.BESCHREIBUNG || !headers.SALDO) {
    return null;
  }
  
  if (!headers.ZAHLUNGSEINGANG || !headers.ZAHLUNGSAUSGANG) {
    const remainingItems = headerLine.filter(
      item => 
        item !== headers.DATUM && 
        item !== headers.TYP && 
        item !== headers.BESCHREIBUNG && 
        item !== headers.SALDO
    ).sort((a, b) => a.x - b.x);
    
    if (remainingItems.length >= 2) {
      headers.ZAHLUNGSEINGANG = remainingItems[0];
      headers.ZAHLUNGSAUSGANG = remainingItems[1];
    }
  }

  if (!headers.ZAHLUNGSEINGANG || !headers.ZAHLUNGSAUSGANG) {
    return null;
  }

  return headers;
}

function calculateCashColumnBoundaries(headers: Headers): ColumnBoundaries {
  let zahlungseingangEnd: number;
  let zahlungsausgangStart: number;
  let paymentsStart: number;

  if (headers.ZAHLUNGEN) {
    const zahlungenMidpoint =
      headers.ZAHLUNGEN.x + headers.ZAHLUNGEN.width / 2;
    zahlungseingangEnd = zahlungenMidpoint;
    zahlungsausgangStart = zahlungenMidpoint;
    paymentsStart = headers.ZAHLUNGEN.x - 5;
  } else {
    zahlungseingangEnd = headers.ZAHLUNGSAUSGANG!.x - 5;
    zahlungsausgangStart = headers.ZAHLUNGSAUSGANG!.x - 5;
    paymentsStart = headers.ZAHLUNGSEINGANG!.x - 5;
  }

  return {
    datum: { start: 0, end: headers.TYP!.x - 5 },
    typ: { start: headers.TYP!.x - 5, end: headers.BESCHREIBUNG!.x - 5 },
    beschreibung: { start: headers.BESCHREIBUNG!.x - 5, end: paymentsStart },
    zahlungseingang: { start: paymentsStart, end: zahlungseingangEnd },
    zahlungsausgang: { start: zahlungsausgangStart, end: headers.SALDO!.x - 5 },
    saldo: { start: headers.SALDO!.x - 5, end: Infinity },
    headerY: headers.DATUM!.y,
  };
}

function extractCashTransactionsFromPage(
  items: TextItem[],
  boundaries: ColumnBoundaries
): TradeRepublicCashTransaction[] {
  const contentItems = items.filter(
    (item) => item.y < boundaries.headerY - 5 && item.text.trim() !== ""
  );
  if (contentItems.length === 0) return [];

  contentItems.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: TextItem[][] = [];
  if (contentItems.length > 0) {
    const avgHeight =
      contentItems.reduce((sum, item) => sum + item.height, 0) /
        contentItems.length || 10;
    const gapThreshold = avgHeight * 1.5;
    let currentRow = [contentItems[0]];
    for (let i = 1; i < contentItems.length; i++) {
      if (contentItems[i - 1].y - contentItems[i].y > gapThreshold) {
        rows.push(currentRow);
        currentRow = [];
      }
      currentRow.push(contentItems[i]);
    }
    rows.push(currentRow);
  }

  const transactions: TradeRepublicCashTransaction[] = [];

  for (const rowItems of rows) {
    const transaction: TradeRepublicCashTransaction = {
      datum: "",
      typ: "",
      beschreibung: "",
      zahlungseingang: "",
      zahlungsausgang: "",
      saldo: "",
    };

    const financialItems: TextItem[] = [];
    for (const item of rowItems) {
      if (item.x < boundaries.datum.end) transaction.datum += " " + item.text;
      else if (item.x < boundaries.typ.end) transaction.typ += " " + item.text;
      else if (item.x < boundaries.beschreibung.end)
        transaction.beschreibung += " " + item.text;
      else financialItems.push(item);
    }

    financialItems.sort((a, b) => a.x - b.x);
    if (financialItems.length > 0) {
      const lastItem = financialItems.pop()!;
      transaction.saldo = lastItem.text;
    }

    for (const item of financialItems) {
      if (item.x < boundaries.zahlungseingang.end)
        transaction.zahlungseingang += " " + item.text;
      else if (item.x < boundaries.zahlungsausgang.end)
        transaction.zahlungsausgang += " " + item.text;
    }

    Object.keys(transaction).forEach((key) => {
      const k = key as keyof TradeRepublicCashTransaction;
      transaction[k] = transaction[k].trim().replace(/\s+/g, " ");
    });

    if (Object.values(transaction).some((val) => val !== "")) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

export interface ParseOptions {
  onProgress?: (current: number, total: number) => void;
  onStatus?: (status: string) => void;
}

export async function parseTradeRepublicPDF(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedPDFResult> {
  const { onProgress, onStatus } = options;

  onStatus?.("Loading PDF library...");

  const pdfjs = await import("pdfjs-dist");
  
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  }

  onStatus?.("Reading PDF file...");

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  onStatus?.("Parsing transactions...");

  const allCashTransactions: TradeRepublicCashTransaction[] = [];
  let cashColumnBoundaries: ColumnBoundaries | null = null;
  let isParsingCash = false;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages);
    onStatus?.(`Processing page ${pageNum} of ${pdf.numPages}`);

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageItems: TextItem[] = textContent.items
      .filter((item) => "str" in item && "transform" in item)
      .map((item) => {
        const textItem = item as { str: string; transform: number[]; width: number; height: number };
        return {
          text: textItem.str,
          x: textItem.transform[4],
          y: textItem.transform[5],
          width: textItem.width,
          height: textItem.height,
        };
      });

    const footerY = FOOTER_BOTTOM_BAND;
    const items = pageItems.filter((it) => it.y > footerY);

    const cashStartMarker = items.find((item) => {
      const t = item.text.trim().toUpperCase();
      return (
        t.includes("UMSATZÜBERSICHT") ||
        t.includes("TRANSAZIONI SUL CONTO") ||
        t.includes("ACCOUNT TRANSACTIONS") ||
        t.includes("TRANSACCIONES DE CUENTA") ||
        t.includes("TRANSACCIONES") ||
        t.includes("MOVIMIENTOS")
      );
    });
    

    const cashEndMarker = items.find((item) => {
      const t = item.text.trim();
      return (
        t.includes("BARMITTELÜBERSICHT") ||
        t.includes("CASH SUMMARY") ||
        t.includes("BALANCE OVERVIEW") ||
        t.includes("RESUMEN DE EFECTIVO") ||
        t.includes("RESUMEN DE SALDO") ||
        t.includes("SALDO DISPONIBLE")
      );
    });

    const shouldProcessCash = isParsingCash || !!cashStartMarker;

    if (shouldProcessCash) {
      let cashItems = [...items];
      
      if (cashStartMarker) {
        cashItems = cashItems.filter((item) => item.y <= cashStartMarker.y);
      }
      if (cashEndMarker) {
        cashItems = cashItems.filter((item) => item.y > cashEndMarker.y);
      }

      const cashHeaders = findCashHeaders(cashItems);
      
      if (cashHeaders) {
        cashColumnBoundaries = calculateCashColumnBoundaries(cashHeaders);
      }

      if (cashColumnBoundaries) {
        const pageCashTransactions = extractCashTransactionsFromPage(
          cashItems,
          cashColumnBoundaries
        );
        allCashTransactions.push(...pageCashTransactions);
      }
    }

    if (cashEndMarker) {
      isParsingCash = false;
    } else if (shouldProcessCash) {
      isParsingCash = true;
    }
  }

  onStatus?.(`Found ${allCashTransactions.length} transactions`);

  let finalBalance: number | undefined;

  for (let pageNum = pdf.numPages; pageNum >= 1; pageNum--) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join(" ");

    if (pageText.toUpperCase().includes("RESUMEN DEL BALANCE") || 
        pageText.toUpperCase().includes("BALANCE OVERVIEW") ||
        pageText.toUpperCase().includes("KONTOÜBERSICHT")) {
      const balanceMatch = pageText.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/g);
      if (balanceMatch && balanceMatch.length > 0) {
        const lastBalance = balanceMatch[balanceMatch.length - 1];
        const balanceStr = lastBalance
          .replace(/€/g, "")
          .replace(/\s/g, "")
          .replace(/\./g, "")
          .replace(",", ".");
        const parsed = parseFloat(balanceStr);
        if (!isNaN(parsed)) {
          finalBalance = parsed;
          break;
        }
      }
    }
  }

  if (finalBalance === undefined && allCashTransactions.length > 0) {
    const lastTx = allCashTransactions[allCashTransactions.length - 1];
    if (lastTx.saldo) {
      const balanceStr = lastTx.saldo
        .replace(/€/g, "")
        .replace(/\s|\u202f/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const parsed = parseFloat(balanceStr);
      if (!isNaN(parsed)) {
        finalBalance = parsed;
      }
    }
  }

  return {
    cash: allCashTransactions,
    interest: [],
    portfolio: [],
    crypto: [],
    finalBalance,
  };
}
