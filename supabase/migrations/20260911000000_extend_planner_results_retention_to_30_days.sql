-- Replace the existing planner-results purge job without changing its hourly schedule.
-- Retention continues to be based only on planner_results.created_at.
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

delete from public.planner_results
where created_at < now() - interval '30 days';

select cron.schedule(
  'purge-expired-planner-results',
  '17 * * * *',
  $cron$
    delete from public.planner_results
    where created_at < now() - interval '30 days';
  $cron$
);
