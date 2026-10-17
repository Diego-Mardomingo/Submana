import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { isBankingConfigured } from "@/lib/banking/enableBanking";
import { expiryReminderEvents, syncConnection } from "@/lib/banking/sync";
import { madridClock } from "@/lib/notifications/jobs/time";
import type { NotifyEvent } from "@/lib/notifications/core";
import { notify } from "@/lib/notifications/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Hour (Madrid) of the daily bank sync; the cron runs at 05:00 and 06:00 UTC to cover summer and winter time. */
const BANK_SYNC_HOUR = 7;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Daily bank sync (see vercel.json): every active connection, one after the other, then the "permission
 * ends soon" reminders. Only problems are notified (movements to review, errors, expiry). Idempotent:
 * dedup skips what was already imported and every notification has a dedupe key.
 * `?force=1` (with the secret) skips the hour check for manual runs.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clock = madridClock();
  if (clock.hour !== BANK_SYNC_HOUR && request.nextUrl.searchParams.get("force") !== "1") {
    return Response.json({ skipped: true, madrid: { date: clock.date, hour: clock.hour } });
  }
  if (!isBankingConfigured()) return Response.json({ skipped: "not_configured" });

  const admin = createAdminClient();
  const { data: connections, error } = await admin.from("bank_connections").select("id").eq("status", "active").order("created_at");
  if (error) {
    console.error("[cron/bank-sync] list", error);
    return Response.json({ error: "list_failed" }, { status: 500 });
  }

  const events: NotifyEvent[] = [];
  const statuses: Record<string, number> = {};
  for (const { id } of connections ?? []) {
    try {
      const outcome = await syncConnection(admin, id, { today: clock.date });
      events.push(...outcome.events);
      statuses[outcome.status] = (statuses[outcome.status] ?? 0) + 1;
    } catch (err) {
      // One connection failing must not stop the others.
      console.error("[cron/bank-sync] sync", id, err);
      statuses.crashed = (statuses.crashed ?? 0) + 1;
    }
  }

  try {
    events.push(...(await expiryReminderEvents(admin, clock.date)));
  } catch (err) {
    console.error("[cron/bank-sync] expiry", err);
  }
  await notify(events);

  return Response.json({ madrid: { date: clock.date, hour: clock.hour }, connections: connections?.length ?? 0, statuses, notifications: events.length });
}
