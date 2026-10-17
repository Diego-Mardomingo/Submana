/**
 * Bank sync (server only, service-role client): reads each linked bank account and imports it through the
 * same pipeline as statements (dedup, merge with manual twins, category inheritance, balance).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountAccess } from "@/lib/apiHelpers";
import { importTransactions } from "@/lib/importTransactions";
import { watchImportBudgets } from "@/lib/notifications/budgets";
import { notifyImport } from "@/lib/notifications/events/imports";
import type { NotifyEvent } from "@/lib/notifications/server";
import { daysBetween, syncWindowStart } from "./dates";
import { EnableBankingError, getBalances, getTransactions, type PsuHeaders } from "./enableBanking";
import { pickBalance, toStatementRows } from "./mapping";
import type { BankSyncResult, SyncMode } from "./types";

/** A sync that started this long ago and never finished (crashed function) no longer holds the lock. */
const LOCK_TTL_MS = 5 * 60 * 1000;
/** Days before the permission ends on which the user is reminded to reconnect. */
export const EXPIRY_REMINDER_DAYS = [7, 1] as const;

export type SyncOutcome =
  | { status: "ok"; result: BankSyncResult; events: NotifyEvent[] }
  | { status: "expired"; events: NotifyEvent[] }
  | { status: "failed" | "busy" | "not_found"; events: NotifyEvent[] };

interface ConnectionRow {
  id: string;
  user_id: string;
  aspsp_name: string;
  valid_until: string | null;
}

interface LinkRow {
  id: string;
  account_id: string;
  bank_account_uid: string;
  sync_mode: SyncMode;
  sync_from: string | null;
  last_synced_at: string | null;
  account: { name: string } | null;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

/** Marks the connection as expired and builds the "permission expired" notification (once per connection). */
async function expire(admin: SupabaseClient, connection: ConnectionRow, account: { id: string; name: string } | null): Promise<NotifyEvent[]> {
  await admin.from("bank_connections").update({ status: "expired", sync_started_at: null }).eq("id", connection.id);
  if (!account) return [];
  return [
    {
      userId: connection.user_id,
      type: "bank.error",
      entityType: "account",
      entityId: account.id,
      params: { accountId: account.id, accountName: account.name, bankName: connection.aspsp_name, reason: "expired" },
      dedupeKey: `bank.expired:${connection.id}`,
    },
  ];
}

/**
 * Syncs every linked account of a connection. `psu` marks it as requested by the user in the app (doesn't
 * count towards the bank's background limit). Returns the notifications to send: the caller decides
 * (the cron sends them; a manual sync shows toasts instead). Never throws for bank errors.
 */
export async function syncConnection(admin: SupabaseClient, connectionId: string, opts: { today: string; psu?: PsuHeaders; userId?: string }): Promise<SyncOutcome> {
  // Lock: only one sync per connection at a time (cron and "sync now" may overlap).
  let lock = admin
    .from("bank_connections")
    .update({ sync_started_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("status", "active")
    .or(`sync_started_at.is.null,sync_started_at.lt."${new Date(Date.now() - LOCK_TTL_MS).toISOString()}"`);
  if (opts.userId) lock = lock.eq("user_id", opts.userId);
  const { data: connection } = await lock.select("id, user_id, aspsp_name, valid_until").maybeSingle<ConnectionRow>();
  if (!connection) {
    const { data: exists } = await admin.from("bank_connections").select("status").eq("id", connectionId).maybeSingle();
    return { status: exists?.status === "active" ? "busy" : exists?.status === "expired" ? "expired" : "not_found", events: [] };
  }

  const { data: linkRows } = await admin
    .from("bank_account_links")
    .select("id, account_id, bank_account_uid, sync_mode, sync_from, last_synced_at, account:accounts(name)")
    .eq("connection_id", connection.id)
    .not("account_id", "is", null);
  const links = (linkRows ?? []) as unknown as LinkRow[];
  const firstAccount = links[0] ? { id: links[0].account_id, name: links[0].account?.name ?? "" } : null;

  if (connection.valid_until && Date.parse(connection.valid_until) <= Date.now()) {
    return { status: "expired", events: await expire(admin, connection, firstAccount) };
  }

  const result: BankSyncResult = { imported: 0, merged: 0, review: 0, balanceUpdated: false };
  const events: NotifyEvent[] = [];
  let lastError: string | null = null;

  for (const link of links) {
    const accountName = link.account?.name ?? "";
    try {
      // The owner may have lost access (left a joint account): skip it rather than write into it.
      const access = await getAccountAccess(admin, connection.user_id, link.account_id);
      if (!access) continue;

      const balance = pickBalance(await getBalances(link.bank_account_uid, opts.psu));

      // Without a start day a full sync would re-import what the statements already brought.
      if (link.sync_mode === "full" && link.sync_from) {
        const since = syncWindowStart(link.sync_from, link.last_synced_at, opts.today);
        const rows = await toStatementRows(link.account_id, await getTransactions(link.bank_account_uid, since, opts.psu), link.sync_from);
        const budgets = access.isJoint ? null : await watchImportBudgets(admin, connection.user_id, rows);
        const imported = await importTransactions({
          supabase: admin,
          userId: connection.user_id,
          accountId: link.account_id,
          transactions: rows,
          finalBalance: balance,
          // Joint accounts only use system categories, so personal ones are never inherited into them.
          inheritCategories: !access.isJoint,
          joint: access.isJoint,
          source: "bank",
          flagPossibleDuplicates: true,
        });
        if ("error" in imported) throw new Error(imported.error);
        result.imported += imported.imported;
        result.merged += imported.merged;
        result.review += imported.review ?? 0;
        result.balanceUpdated ||= balance != null;
        if (imported.imported > 0) notifyImport({ accountId: link.account_id, imported: imported.imported, joint: access.isJoint, actorId: connection.user_id });
        await budgets?.finish();
        if (imported.review) {
          events.push({
            userId: connection.user_id,
            type: "bank.review",
            entityType: "account",
            entityId: link.account_id,
            params: { accountId: link.account_id, accountName, count: imported.review },
            dedupeKey: `bank.review:${link.account_id}:${opts.today}`,
          });
        }
      } else if (balance != null) {
        const { error } = await admin.from("accounts").update({ balance }).eq("id", link.account_id);
        if (error) throw error;
        result.balanceUpdated = true;
      }

      await admin.from("bank_account_links").update({ last_synced_at: new Date().toISOString() }).eq("id", link.id);
    } catch (error) {
      if (error instanceof EnableBankingError && error.sessionEnded) {
        return { status: "expired", events: [...events, ...(await expire(admin, connection, { id: link.account_id, name: accountName }))] };
      }
      lastError = errorText(error);
      console.error("[banking] sync", connection.id, lastError);
      // The bank's daily limit is not worth a notification: the next run catches up.
      if (!(error instanceof EnableBankingError && error.rateLimited)) {
        events.push({
          userId: connection.user_id,
          type: "bank.error",
          entityType: "account",
          entityId: link.account_id,
          params: { accountId: link.account_id, accountName, bankName: connection.aspsp_name, reason: "failed" },
          dedupeKey: `bank.error:${link.account_id}:${opts.today}`,
        });
      }
    }
  }

  await admin
    .from("bank_connections")
    .update({ sync_started_at: null, last_error: lastError, ...(lastError ? {} : { last_synced_at: new Date().toISOString() }) })
    .eq("id", connection.id);

  // Nothing at all got through: report it as a failure (the error notifications are already in `events`).
  if (lastError && result.imported === 0 && !result.balanceUpdated) return { status: "failed", events };
  return { status: "ok", result, events };
}

/** "Your permission ends in N days" reminders for active connections, `EXPIRY_REMINDER_DAYS` before the end. */
export async function expiryReminderEvents(admin: SupabaseClient, today: string): Promise<NotifyEvent[]> {
  const { data } = await admin
    .from("bank_connections")
    .select("id, user_id, aspsp_name, valid_until, links:bank_account_links(account_id, account:accounts(name))")
    .eq("status", "active")
    .not("valid_until", "is", null);
  const events: NotifyEvent[] = [];
  for (const row of (data ?? []) as unknown as (ConnectionRow & { links: { account_id: string | null; account: { name: string } | null }[] })[]) {
    const end = row.valid_until!.slice(0, 10);
    const days = daysBetween(today, end);
    if (!(EXPIRY_REMINDER_DAYS as readonly number[]).includes(days)) continue;
    const link = row.links.find((l) => l.account_id);
    if (!link?.account_id) continue;
    events.push({
      userId: row.user_id,
      type: "bank.expiring",
      entityType: "account",
      entityId: link.account_id,
      params: { accountId: link.account_id, accountName: link.account?.name ?? "", bankName: row.aspsp_name, date: end, days },
      dedupeKey: `bank.expiring:${row.id}:${days}`,
    });
  }
  return events;
}
