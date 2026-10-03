-- Elimina la automatización (atajos de iOS / MacroDroid): tokens, log de peticiones y el origen 'automation'.
-- Las transacciones creadas por la automatización pasan a 'manual' (son filas normales del usuario).

update public.transactions set source = 'manual' where source = 'automation';

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check check (source in ('manual', 'import', 'shared'));

drop table if exists public.automation_notifications;
drop table if exists public.api_tokens;
