-- Suscripciones cada X días (issue #91): "daily" se suma a las frecuencias permitidas.
alter table public.subscriptions
  drop constraint subscriptions_frequency_check,
  add constraint subscriptions_frequency_check check (frequency in ('daily', 'weekly', 'monthly', 'yearly'));
