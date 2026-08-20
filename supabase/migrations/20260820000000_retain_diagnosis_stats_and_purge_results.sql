create table if not exists public.diagnosis_daily_stats (
  stat_date date primary key,
  diagnosis_count bigint not null default 0 check (diagnosis_count >= 0)
);

alter table public.diagnosis_daily_stats enable row level security;

revoke all on table public.diagnosis_daily_stats from anon;
revoke all on table public.diagnosis_daily_stats from authenticated;

create schema if not exists private;

create or replace function private.record_planner_result_diagnosis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.diagnosis_daily_stats (stat_date, diagnosis_count)
  values ((new.created_at at time zone 'Asia/Seoul')::date, 1)
  on conflict (stat_date) do update
  set diagnosis_count = public.diagnosis_daily_stats.diagnosis_count + 1;

  return new;
end;
$$;

revoke all on function private.record_planner_result_diagnosis() from public;
revoke all on function private.record_planner_result_diagnosis() from anon;
revoke all on function private.record_planner_result_diagnosis() from authenticated;

drop trigger if exists record_planner_result_diagnosis on public.planner_results;
create trigger record_planner_result_diagnosis
after insert on public.planner_results
for each row execute function private.record_planner_result_diagnosis();

insert into public.diagnosis_daily_stats (stat_date, diagnosis_count)
select
  (created_at at time zone 'Asia/Seoul')::date,
  count(*)
from public.planner_results
group by 1
on conflict (stat_date) do update
set diagnosis_count = excluded.diagnosis_count;

create or replace function public.admin_daily_stats()
returns table (
  stat_date date,
  signup_count bigint,
  diagnosis_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'admin access required';
  end if;

  return query
  select
    coalesce(s.d, d.stat_date) as stat_date,
    coalesce(s.cnt, 0) as signup_count,
    coalesce(d.diagnosis_count, 0) as diagnosis_count
  from (
    select (created_at at time zone 'Asia/Seoul')::date as d, count(*) as cnt
    from public.profiles
    group by 1
  ) s
  full outer join public.diagnosis_daily_stats d on s.d = d.stat_date
  order by 1 desc;
end;
$$;

revoke execute on function public.admin_daily_stats() from public;
revoke execute on function public.admin_daily_stats() from anon;
grant execute on function public.admin_daily_stats() to authenticated;

create index if not exists planner_results_created_at_idx
on public.planner_results (created_at);

-- Backfill the anonymous counts before enforcing the retention period.
delete from public.planner_results
where created_at < now() - interval '7 days';

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'purge-expired-planner-results'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'purge-expired-planner-results',
  '17 * * * *',
  $cron$
    delete from public.planner_results
    where created_at < now() - interval '7 days';
  $cron$
);
