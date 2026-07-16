create extension if not exists "pgcrypto";

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('shop_staff', 'customer')),
  store_id uuid references public.stores(id) on delete set null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.shoe_references (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  brand text not null,
  model text not null,
  eu_size text not null,
  top_photo_path text,
  side_photo_path text,
  measurement_source text not null check (measurement_source in ('insole', 'inside_shoe', 'outsole_estimated')) default 'insole',
  usable_length_mm numeric,
  usable_width_mm numeric,
  toe_shape text check (toe_shape in ('straight', 'slope', 'fan', 'unknown')) default 'unknown',
  rist55_mm numeric,
  measurement_confidence text not null check (measurement_confidence in ('low', 'medium', 'high')) default 'low',
  llm_analysis jsonb,
  staff_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.foot_scans (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  customer_label text,
  top_photo_path text,
  side_photo_path text,
  foot_length_mm numeric,
  foot_width_mm numeric,
  toe_shape text check (toe_shape in ('straight', 'slope', 'fan', 'unknown')) default 'unknown',
  rist55_mm numeric,
  measurement_confidence text not null check (measurement_confidence in ('low', 'medium', 'high')) default 'low',
  llm_analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.matching_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  is_active boolean not null default false,
  rules jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create unique index if not exists one_active_matching_profile
on public.matching_profiles (is_active)
where is_active = true;

insert into public.matching_profiles (name, version, is_active, rules, notes)
values (
  'barfuss_mvp_default',
  1,
  true,
  '{
    "length": {
      "idealRoomMm": { "min": 8, "max": 12 },
      "acceptableRoomMm": { "min": 5, "max": 15 }
    },
    "width": {
      "passMinDeltaMm": 0,
      "tightMinDeltaMm": -2
    },
    "toeShape": {
      "mode": "llm_qualitative",
      "statuses": ["passend", "kritisch", "unbekannt"]
    },
    "instep": {
      "source": "rist55",
      "mode": "llm_qualitative",
      "statuses": ["niedriges Risiko", "mittleres Risiko", "hohes Risiko", "unbekannt"]
    },
    "measurementSourceWeights": {
      "insole": 1,
      "inside_shoe": 0.85,
      "outsole_estimated": 0.65
    }
  }'::jsonb,
  'V1 nutzt LLM-Schaetzungen fuer Fuss- und Schuhmesswerte. Diese Regeln bilden die erklaerbare Business-Logik fuer das Matching.'
)
on conflict (name, version) do nothing;

create table if not exists public.fit_matches (
  id uuid primary key default gen_random_uuid(),
  foot_scan_id uuid not null references public.foot_scans(id) on delete cascade,
  shoe_reference_id uuid not null references public.shoe_references(id) on delete cascade,
  matching_profile_id uuid not null references public.matching_profiles(id) on delete restrict,
  score numeric,
  length_status text check (length_status in ('passt', 'knapp', 'zu kurz', 'zu lang', 'unbekannt')) default 'unbekannt',
  width_status text check (width_status in ('passt', 'knapp', 'zu schmal', 'unbekannt')) default 'unbekannt',
  toe_box_status text check (toe_box_status in ('passend', 'kritisch', 'unbekannt')) default 'unbekannt',
  instep_status text check (instep_status in ('niedriges Risiko', 'mittleres Risiko', 'hohes Risiko', 'unbekannt')) default 'unbekannt',
  recommendation_text text,
  explanation jsonb,
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
