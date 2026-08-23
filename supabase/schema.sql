-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  specialty text,
  professional text,
  place text,
  address text,
  date date not null,
  time time,
  notes text,
  status text not null default 'upcoming',
  remind_minutes_before integer default 1440,
  notification_sent boolean default false,
  created_at timestamptz default now()
);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  dose text,
  frequency text,
  schedule jsonb not null default '[]'::jsonb,
  prescription_text text,
  stock integer,
  stock_unit text default 'unidades',
  low_stock_threshold integer default 7,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid references medications(id) on delete cascade,
  medication_name text,
  scheduled_at timestamptz,
  taken_at timestamptz default now(),
  status text default 'taken',
  notes text
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date not null,
  due_time time,
  notes text,
  status text default 'pending',
  remind_minutes_before integer default 60,
  notification_sent boolean default false,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null,
  payment_method text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists glucose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  value integer not null,
  notes text
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  updated_at timestamptz default now()
);

-- RLS
alter table appointments enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table reminders enable row level security;
alter table expenses enable row level security;
alter table glucose_logs enable row level security;
alter table push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['appointments','medications','medication_logs','reminders','expenses','glucose_logs','push_subscriptions']
  loop
    execute format('drop policy if exists "own rows %1$s" on %1$I', t);
    execute format('create policy "own rows %1$s" on %1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Medicamentos identificados nas receitas. Os horários ficam vazios de propósito quando
-- a receita não informa um horário exato. Insira após criar/login do usuário.
-- Use supabase/seed_medicamentos.sql depois de substituir SEU_USER_UUID.
