import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { cleanupNotifications } from "@/lib/notifications/jobs/cleanup";
import { loadImportReminderEvents } from "@/lib/notifications/jobs/importReminder";
import { loadRenewalEvents } from "@/lib/notifications/jobs/renewals";
import { loadSummaryEvents } from "@/lib/notifications/jobs/summary";
import { isSendHour, madridClock } from "@/lib/notifications/jobs/time";
import type { NotifyEvent } from "@/lib/notifications/core";
import { notify } from "@/lib/notifications/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Daily notifications (see vercel.json: two crons, 15:00 and 16:00 UTC; only the one that lands on 17:00
 * in Madrid does anything). Idempotent: every notification has a dedupe key, so a rerun adds nothing.
 * `?force=1` (with the secret) skips the hour check for manual runs.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clock = madridClock();
  if (!isSendHour(clock) && request.nextUrl.searchParams.get("force") !== "1") {
    return Response.json({ skipped: true, madrid: { date: clock.date, hour: clock.hour } });
  }

  const admin = createAdminClient();
  const result: Record<string, unknown> = { madrid: { date: clock.date, hour: clock.hour } };
  const errors: string[] = [];

  // One job failing must not stop the others.
  const run = async (name: string, load: () => Promise<NotifyEvent[]>) => {
    try {
      const events = await load();
      await notify(events);
      result[name] = { events: events.length };
    } catch (error) {
      console.error(`[cron/notifications] ${name}`, error);
      errors.push(name);
    }
  };
  await run("renewals", () => loadRenewalEvents(admin, clock));
  await run("summary", () => loadSummaryEvents(admin, clock));
  await run("importReminder", () => loadImportReminderEvents(admin, clock));
  try {
    result.cleanup = { deleted: await cleanupNotifications(admin) };
  } catch (error) {
    console.error("[cron/notifications] cleanup", error);
    errors.push("cleanup");
  }

  return Response.json({ ...result, ...(errors.length > 0 && { errors }) }, { status: errors.length > 0 ? 500 : 200 });
}
