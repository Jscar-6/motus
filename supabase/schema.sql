-- TrueReach F11 schema: patients, recordings, the `recordings` storage bucket and Realtime.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query), then run seed.sql.
-- Demo scope (PLAN.md §20 F11): one physician, no login, so the anon key may read and write. Test patients only.

create extension if not exists pgcrypto;

create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  affected_side text not null default 'right' check (affected_side in ('left', 'right')),
  note          text,                                  -- free text the physician sees, e.g. "Left MCA stroke, 6 weeks"
  is_sample     boolean not null default false,        -- seeded sample patient, badged "Sample" in the UI
  created_at    timestamptz not null default now()
);

create table if not exists public.recordings (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients (id) on delete cascade,
  exercise_id       text not null default 'forward_reach',
  mode              text not null default 'camera' check (mode in ('camera', 'camera+sleeve')),
  status            text not null default 'recording' check (status in ('recording', 'uploading', 'ready', 'failed')),
  started_at        timestamptz not null default now(),
  duration_ms       integer,
  video_path        text,                              -- storage path in the `recordings` bucket
  timeline_path     text,
  thumb_path        text,
  frame_count       integer,
  flagged_frames    integer,                           -- frames with at least one rule flag
  pct_compensating  real,                              -- flagged_frames / frame_count, 0–1
  flag_counts       jsonb not null default '{}'::jsonb, -- { "trunk_lean": 3, ... } rising-edge flag events per label
  peaks             jsonb not null default '{}'::jsonb, -- { "maxLeanDeg": 12.1, "maxHikeRatio": 0.08, "minElbowDeg": 141, "maxShoulderFlexDeg": 88 }
  is_sample         boolean not null default false
);

create index if not exists recordings_patient_started on public.recordings (patient_id, started_at desc);

alter table public.patients   enable row level security;
alter table public.recordings enable row level security;

drop policy if exists "demo anon all" on public.patients;
drop policy if exists "demo anon all" on public.recordings;
create policy "demo anon all" on public.patients   for all to anon, authenticated using (true) with check (true);
create policy "demo anon all" on public.recordings for all to anon, authenticated using (true) with check (true);

-- Realtime: the physician pages subscribe to inserts and updates on both tables.
alter table public.recordings replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'recordings') then
    alter publication supabase_realtime add table public.recordings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'patients') then
    alter publication supabase_realtime add table public.patients;
  end if;
end $$;

-- Storage: public-read bucket so <video> can stream by URL; 50 MB per file (free-tier cap).
insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "demo anon read recordings" on storage.objects;
drop policy if exists "demo anon write recordings" on storage.objects;
create policy "demo anon read recordings"  on storage.objects for select to anon, authenticated using (bucket_id = 'recordings');
create policy "demo anon write recordings" on storage.objects for insert to anon, authenticated with check (bucket_id = 'recordings');
