-- Review deck (/review): movements from the bank the app isn't sure about wait in a stack of cards.
-- The import writes review_state/review_reason (src/lib/review/classify.ts); the deck only reads them
-- and moves them to 'later' or 'done'. Rows with review_state null were never in the deck.
alter table public.transactions
  add column if not exists review_state text check (review_state in ('pending', 'later', 'done')),
  -- Why it is in the deck: a known merchant ('sure', only shown when reviewing everything), one spread
  -- over several categories ('doubt'), never seen before ('new'), a possible transfer between own
  -- accounts ('transfer') or money that may be someone's share of a recent expense ('settle').
  add column if not exists review_reason text check (review_reason in ('sure', 'doubt', 'new', 'transfer', 'settle'));

create index if not exists transactions_review_open_idx on public.transactions (user_id, date desc)
  where review_state in ('pending', 'later');

-- What the user taught the deck: bank text (normalised by normalizeMerchant) → category. Rules beat the
-- category inherited from earlier movements.
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern text not null check (length(pattern) between 1 and 120),
  category_id uuid not null references public.categories (id) on delete cascade,
  subcategory_id uuid references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern)
);

create index if not exists category_rules_category_idx on public.category_rules (category_id);
create index if not exists category_rules_subcategory_idx on public.category_rules (subcategory_id);

alter table public.category_rules enable row level security;

drop policy if exists category_rules_own on public.category_rules;
create policy category_rules_own on public.category_rules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- What the deck shows ('doubt': only what the app isn't sure about; 'all': every new movement) and the
-- weekly "to review" notification: ISO weekday (1 = Monday) and how many pending movements it needs.
alter table public.notification_settings
  add column if not exists review_mode text not null default 'doubt' check (review_mode in ('doubt', 'all')),
  add column if not exists review_day smallint not null default 1 check (review_day between 1 and 7),
  add column if not exists review_min smallint not null default 1 check (review_min in (1, 3, 5, 10));
