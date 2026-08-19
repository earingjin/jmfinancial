create or replace function public.admin_daily_stats()
returns table (
  stat_date date,
  signup_count bigint,
  diagnosis_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'admin access required';
  end if;

  return query
  select
    coalesce(s.d, d.d) as stat_date,
    coalesce(s.cnt, 0) as signup_count,
    coalesce(d.cnt, 0) as diagnosis_count
  from
    (select created_at::date as d, count(*) as cnt from public.profiles group by 1) s
  full outer join
    (select created_at::date as d, count(*) as cnt from public.planner_results group by 1) d
    on s.d = d.d
  order by 1 desc;
end;
$$;

revoke all on function public.admin_daily_stats() from public;
revoke all on function public.admin_daily_stats() from anon;
grant execute on function public.admin_daily_stats() to authenticated;
;
