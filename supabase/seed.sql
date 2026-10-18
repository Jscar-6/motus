-- TrueReach F11 seed: the live demo patient plus sample patients so the physician overview isn't empty.
-- Sample rows are made-up demo data, flagged is_sample = true and badged "Sample" in the UI. They have no video.
-- Safe to re-run: it clears earlier sample rows first.

delete from public.patients where is_sample;

insert into public.patients (name, affected_side, note)
select 'Demo Patient', 'right', 'Live hackathon demo'
where not exists (select 1 from public.patients where not is_sample);

with sample (name, side, note, base) as (
  values
    ('Maria Alvarez',   'left',  'Sample patient', 0.42),
    ('James Okafor',    'right', 'Sample patient', 0.18),
    ('Lena Fischer',    'right', 'Sample patient', 0.09),
    ('Arjun Mehta',     'left',  'Sample patient', 0.27)
),
ins as (
  insert into public.patients (name, affected_side, note, is_sample)
  select name, side, note, true from sample
  returning id, name
)
insert into public.recordings (patient_id, status, started_at, duration_ms, frame_count, flagged_frames, pct_compensating, flag_counts, is_sample)
select
  ins.id,
  'ready',
  now() - make_interval(days => 7 - d),
  90000,
  2700,
  round(2700 * p.pct)::int,
  p.pct,
  jsonb_build_object('trunk_lean', round(p.pct * 14)::int, 'shoulder_hike', round(p.pct * 5)::int),
  true
from ins
join sample s on s.name = ins.name
cross join generate_series(0, 6) as d
cross join lateral (select greatest(0.02, s.base - d * 0.025 + (random() - 0.5) * 0.06) as pct) p;
