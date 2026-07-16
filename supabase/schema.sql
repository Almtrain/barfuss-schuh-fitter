create extension if not exists "pgcrypto";

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.shoe_models (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  brand text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shoe_sizes (
  id uuid primary key default gen_random_uuid(),
  shoe_model_id uuid not null references public.shoe_models(id) on delete cascade,
  eu_size text not null,
  usable_length_mm numeric,
  usable_width_mm numeric,
  toe_shape text check (toe_shape in ('straight', 'slope', 'fan', 'unknown')) default 'unknown',
  rist55_mm numeric,
  measurement_confidence text check (measurement_confidence in ('low', 'medium', 'high')) default 'low',
  created_at timestamptz not null default now()
);

create table if not exists public.fit_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  customer_label text,
  top_photo_path text,
  side_photo_path text,
  foot_length_mm numeric,
  foot_width_mm numeric,
  toe_shape text check (toe_shape in ('straight', 'slope', 'fan', 'unknown')) default 'unknown',
  rist55_mm numeric,
  analysis jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('fit-photos', 'fit-photos', true)
on conflict (id) do nothing;

create policy "Public fit photo reads"
on storage.objects for select
using (bucket_id = 'fit-photos');

create policy "Server fit photo writes"
on storage.objects for insert
with check (bucket_id = 'fit-photos');
