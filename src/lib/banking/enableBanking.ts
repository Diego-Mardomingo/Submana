/**
 * Enable Banking API client (server only: it signs requests with the application's private key).
 * Docs: https://enablebanking.com/docs/api/reference/
 * Env: ENABLE_BANKING_APP_ID and ENABLE_BANKING_KEY (the application's .pem, base64-encoded on one line).
 */
import { createSign } from "node:crypto";
import type { EbAccount, EbBalance, EbTransaction } from "./types";

const API = "https://api.enablebanking.com";
/** Tokens may live up to 24 h; a short one is enough for a request or a sync run. */
const TOKEN_TTL_SECONDS = 3600;
/** Safety cap for paginated transaction reads. */
const MAX_PAGES = 50;

export class EnableBankingError extends Error {
  constructor(
    readonly status: number,
    /** Enable Banking error code, e.g. EXPIRED_SESSION, ASPSP_RATE_LIMIT_EXCEEDED. */
    readonly code: string | null,
    message: string
  ) {
    super(message);
    this.name = "EnableBankingError";
  }

  /** The bank permission ended (expired or revoked): only a new authorisation helps. */
  get sessionEnded() {
    return this.code === "EXPIRED_SESSION" || this.code === "REVOKED_SESSION" || this.code === "CLOSED_SESSION" || this.status === 401;
  }

  /** The bank's daily limit for unattended reads (often 4/day): try again later. */
  get rateLimited() {
    return this.status === 429 || this.code === "ASPSP_RATE_LIMIT_EXCEEDED";
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const key = process.env.ENABLE_BANKING_KEY;
  if (!appId || !key) throw new Error("Missing ENABLE_BANKING_APP_ID or ENABLE_BANKING_KEY");
  return { appId, privateKey: Buffer.from(key, "base64").toString("utf8") };
}

export const isBankingConfigured = () => !!process.env.ENABLE_BANKING_APP_ID && !!process.env.ENABLE_BANKING_KEY;

/** RS256 JWT identifying the application (not the user); reused until a minute before it expires. */
function token() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;
  const { appId, privateKey } = credentials();
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${b64({ typ: "JWT", alg: "RS256", kid: appId })}.${b64({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + TOKEN_TTL_SECONDS })}`;
  const value = `${data}.${createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url")}`;
  cachedToken = { value, expiresAt: now + TOKEN_TTL_SECONDS };
  return value;
}

/**
 * Headers telling the bank the user is in the app right now: requests with them don't count towards the
 * limit for background reads. Only pass them for requests the user triggered.
 */
export type PsuHeaders = { ipAddress?: string | null; userAgent?: string | null };

function psuHeaders(psu?: PsuHeaders): Record<string, string> {
  if (!psu) return {};
  return {
    ...(psu.ipAddress && { "Psu-Ip-Address": psu.ipAddress }),
    ...(psu.userAgent && { "Psu-User-Agent": psu.userAgent.slice(0, 255) }),
  };
}

async function request<T>(path: string, init: { method?: string; body?: unknown; psu?: PsuHeaders } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
      ...psuHeaders(init.psu),
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // Only the code and the generic message: responses may echo account data.
    const code = typeof json?.error === "string" ? json.error : null;
    const message = typeof json?.message === "string" ? json.message : `HTTP ${res.status}`;
    throw new EnableBankingError(res.status, code, `${init.method ?? "GET"} ${path.split("?")[0].replace(/[0-9a-f-]{36}/g, ":id")}: ${code ?? ""} ${message}`.trim());
  }
  return json as T;
}

/** Longest consent (seconds) the bank allows, from GET /aspsps; null when it isn't listed. */
export async function maxConsentSeconds(aspsp: { name: string; country: string }): Promise<number | null> {
  const { aspsps } = await request<{ aspsps: { name: string; country: string; maximum_consent_validity?: number }[] }>(
    `/aspsps?country=${encodeURIComponent(aspsp.country)}&service=AIS`
  );
  const found = aspsps.find((a) => a.name === aspsp.name);
  return found?.maximum_consent_validity ?? null;
}

/** Starts the trip to the bank: returns the URL to send the user to. */
export async function startAuthorization(args: { aspsp: { name: string; country: string }; state: string; redirectUrl: string; validUntil: Date; psu?: PsuHeaders }) {
  return request<{ url: string; authorization_id: string }>("/auth", {
    method: "POST",
    psu: args.psu,
    body: {
      access: { valid_until: args.validUntil.toISOString() },
      aspsp: args.aspsp,
      state: args.state,
      redirect_url: args.redirectUrl,
      psu_type: "personal",
    },
  });
}

/** Exchanges the code the bank sent back for a session with the authorised accounts. */
export async function createSession(code: string) {
  return request<{ session_id: string; accounts: EbAccount[]; access: { valid_until: string } }>("/sessions", { method: "POST", body: { code } });
}

/** Closes a session (the bank permission ends). Never throws: the session may already be gone. */
export async function deleteSession(sessionId: string) {
  try {
    await request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  } catch (error) {
    console.error("[banking] deleteSession", error instanceof Error ? error.message : error);
  }
}

export async function getBalances(accountUid: string, psu?: PsuHeaders) {
  const { balances } = await request<{ balances: EbBalance[] }>(`/accounts/${encodeURIComponent(accountUid)}/balances`, { psu });
  return balances;
}

/**
 * Booked transactions since `dateFrom` (YYYY-MM-DD), following every page. Some banks (Trade Republic)
 * answer the last page's continuation key with that same page and key: a page that hands back the key it
 * was asked with, or one already seen, is a repeat and is dropped.
 */
export async function getTransactions(accountUid: string, dateFrom: string, psu?: PsuHeaders): Promise<EbTransaction[]> {
  const all: EbTransaction[] = [];
  const seenKeys = new Set<string>();
  let key: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ date_from: dateFrom, transaction_status: "BOOK" });
    if (key) params.set("continuation_key", key);
    const res = await request<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      `/accounts/${encodeURIComponent(accountUid)}/transactions?${params}`,
      { psu }
    );
    const next = res.continuation_key ?? undefined;
    if (key && next && (next === key || seenKeys.has(next))) break;
    all.push(...(res.transactions ?? []));
    if (!next) break;
    seenKeys.add(next);
    key = next;
  }
  return all;
}
