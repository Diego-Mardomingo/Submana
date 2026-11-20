-- Each feedback row becomes a GitHub issue (src/lib/feedbackIssues.ts). The server writes these
-- columns with the service role; users have no update policy on feedback, so they can't touch them.
alter table public.feedback
  add column if not exists github_issue_number integer,
  -- Set when a server process starts creating the issue, so the API route and the daily retry
  -- don't both create it.
  add column if not exists github_issue_claimed_at timestamptz;

create index if not exists idx_feedback_pending_github_issue on public.feedback (created_at)
  where github_issue_number is null;
