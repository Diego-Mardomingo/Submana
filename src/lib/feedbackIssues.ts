import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackType } from "@/lib/feedback";

/**
 * Feedback sent from the app becomes a GitHub issue. The repo is public, so the issue carries the
 * message and nothing about who sent it (no user id or email). The feedback id is there to find the
 * row in Supabase. The token (`GITHUB_FEEDBACK_TOKEN`) is a fine-grained PAT for this repo only,
 * with Issues read and write and nothing else. It lives only on the server.
 */

export type FeedbackRow = { id: string; type: FeedbackType; message: string; created_at: string };

const DEFAULT_REPO = "Diego-Mardomingo/Submana";
const LABELS: Record<FeedbackType, string[]> = { error: ["bug", "feedback"], suggestion: ["enhancement", "feedback"] };
const TITLE_MAX = 80;
/** A claim older than this is treated as a crashed attempt and can be retried. */
const CLAIM_TTL_MS = 10 * 60 * 1000;

/** The word joiner: invisible, but it stops GitHub from reading `@name` as a mention or `#12` as a reference. */
const WJ = "\u2060";

/**
 * User text rendered literally: markdown and HTML are escaped, and mentions (`@user`, `@org/team`)
 * and references (`#12`, `owner/repo#12`, `GH-12`) are broken so a message can't notify people or
 * link to other issues.
 */
export function neutralizeUserText(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}[\]()#+\-.!|~]/g, (c) => `\\${c}`)
    .replace(/@/g, `@${WJ}`)
    .replace(/#/g, `#${WJ}`)
    .replace(/\b(GH)-(\d)/gi, `$1-${WJ}$2`);
}

/** First line of the message, collapsed and cut at a word boundary. */
export function feedbackIssueTitle(message: string) {
  const line = message.trim().split(/\r?\n/).find((l) => l.trim()) ?? "";
  const flat = line.replace(/\s+/g, " ").trim();
  if (flat.length <= TITLE_MAX) return flat.replace(/@/g, `@${WJ}`).replace(/#/g, `#${WJ}`);
  const cut = flat.slice(0, TITLE_MAX - 1);
  const space = cut.lastIndexOf(" ");
  const title = `${(space > TITLE_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
  return title.replace(/@/g, `@${WJ}`).replace(/#/g, `#${WJ}`);
}

export function feedbackIssueBody(row: FeedbackRow) {
  const quoted = neutralizeUserText(row.message.replace(/\r\n?/g, "\n").trim())
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
  const kind = row.type === "error" ? "Error enviado" : "Sugerencia enviada";
  return `${quoted}\n\n---\n${kind} desde la app · ${row.created_at.slice(0, 10)} · feedback \`${row.id}\``;
}

async function createGitHubIssue(row: FeedbackRow, token: string): Promise<number> {
  const repo = process.env.GITHUB_FEEDBACK_REPO || DEFAULT_REPO;
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "submana-feedback",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: feedbackIssueTitle(row.message), body: feedbackIssueBody(row), labels: LABELS[row.type] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const issue = (await res.json()) as { number: number };
  return issue.number;
}

/**
 * Creates the issue for one feedback row unless it already has one or another process is on it.
 * `admin` must be the service-role client: users can't write these columns. Returns the issue
 * number, or null when skipped. Throws when GitHub or the database fails (the row stays pending).
 */
export async function syncFeedbackIssue(admin: SupabaseClient, row: FeedbackRow): Promise<number | null> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) return null;

  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("feedback")
    .update({ github_issue_claimed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("github_issue_number", null)
    .or(`github_issue_claimed_at.is.null,github_issue_claimed_at.lt."${staleBefore}"`)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed?.length) return null;

  let number: number;
  try {
    number = await createGitHubIssue(row, token);
  } catch (error) {
    // Release the claim so the daily retry can pick it up straight away.
    await admin.from("feedback").update({ github_issue_claimed_at: null }).eq("id", row.id);
    throw error;
  }
  const { error } = await admin.from("feedback").update({ github_issue_number: number }).eq("id", row.id);
  if (error) throw error;
  return number;
}

/** Daily retry for rows whose issue wasn't created (GitHub down, missing token at the time...). */
export async function syncPendingFeedbackIssues(admin: SupabaseClient, limit = 20) {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return { created: 0, skipped: "no_token" as const };
  const { data, error } = await admin
    .from("feedback")
    .select("id, type, message, created_at")
    .is("github_issue_number", null)
    .order("created_at")
    .limit(limit);
  if (error) throw error;
  let created = 0;
  for (const row of (data ?? []) as FeedbackRow[]) {
    if (await syncFeedbackIssue(admin, row)) created++;
  }
  return { created };
}
