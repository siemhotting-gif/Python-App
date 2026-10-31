-- Who has paid. Only the edge functions (service role) can read or write this table:
-- row level security is on and there are no policies, so the public anon key gets nothing.
create table if not exists public.purchases (
  user_id uuid primary key references auth.users (id) on delete cascade,
  paid boolean not null default false,
  stripe_session_id text,
  stripe_payment_intent text,
  amount_total integer,
  currency text,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
create index if not exists purchases_payment_intent_idx on public.purchases (stripe_payment_intent);

-- Private bucket for the full app file (app.html). Not public: only the "app" function reads it.
insert into storage.buckets (id, name, public) values ('app', 'app', false) on conflict (id) do nothing;
