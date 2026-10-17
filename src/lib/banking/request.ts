/** Request helpers shared by the banking routes. */
import type { NextRequest } from "next/server";
import { calendarDayInAppTimeZone } from "@/lib/date";
import type { PsuHeaders } from "./enableBanking";

/** The user is in the app: their IP and browser tell the bank this read isn't a background one. */
export function psuFrom(request: NextRequest): PsuHeaders {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

/** Where the bank sends the user back (must be one of the application's registered redirect URLs). */
export const callbackUrl = (request: NextRequest) => `${request.nextUrl.origin}/api/banking/callback`;

/** Today (YYYY-MM-DD) in the app's time zone. */
export const todayInApp = () => calendarDayInAppTimeZone(new Date().toISOString());
