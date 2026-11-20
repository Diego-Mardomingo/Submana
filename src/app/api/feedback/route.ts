import { after, NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";
import { FEEDBACK_MESSAGE_MAX } from "@/lib/feedback";
import { syncFeedbackIssue, type FeedbackRow } from "@/lib/feedbackIssues";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`feedback:${user.id}`, RATE_LIMITS.feedback.limit, RATE_LIMITS.feedback.windowSeconds);
  if (limited) return limited;

  const body = await parseRequestBody(request);
  const message = (body.message || "").trim();
  if (body.type !== "error" && body.type !== "suggestion") return jsonError("type must be 'error' or 'suggestion'");
  if (!message) return jsonError("message is required");
  if (message.length > FEEDBACK_MESSAGE_MAX) return jsonError(`message must be at most ${FEEDBACK_MESSAGE_MAX} characters`);

  const { data, error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, type: body.type, message })
    .select("id, type, message, created_at")
    .single();
  if (error) return jsonServerError("feedback", error);

  // The GitHub issue is created after replying; if it fails, the daily cron retries it.
  after(async () => {
    try {
      await syncFeedbackIssue(createAdminClient(), data as FeedbackRow);
    } catch (err) {
      console.error("[feedback] github issue", err);
    }
  });

  return jsonResponse({ data }, 201);
}
