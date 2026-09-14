import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baseSql = readFileSync(
  new URL('../../supabase/migrations/20260820000000_retain_diagnosis_stats_and_purge_results.sql', import.meta.url),
  'utf8'
).toLowerCase();
const retentionPolicySql = readFileSync(
  new URL('../../supabase/migrations/20260911000000_extend_planner_results_retention_to_30_days.sql', import.meta.url),
  'utf8'
).toLowerCase();

describe('planner results retention migration', () => {
  it('keeps only anonymous daily diagnosis counts', () => {
    expect(baseSql).toContain('create table if not exists public.diagnosis_daily_stats');
    expect(baseSql).toContain('stat_date date primary key');
    expect(baseSql).toContain('diagnosis_count bigint not null');
    expect(baseSql).not.toMatch(/diagnosis_daily_stats[\s\S]*user_id/);
    expect(baseSql).not.toMatch(/diagnosis_daily_stats[\s\S]*result_json/);
    expect(baseSql).not.toMatch(/diagnosis_daily_stats[\s\S]*input_json/);
  });

  it('records each completed result once through an insert trigger', () => {
    expect(baseSql).toContain('after insert on public.planner_results');
    expect(baseSql).toContain("new.created_at at time zone 'asia/seoul'");
    expect(baseSql).toContain('diagnosis_count = public.diagnosis_daily_stats.diagnosis_count + 1');
  });

  it('moves the admin diagnosis source away from sensitive results', () => {
    const functionStart = baseSql.lastIndexOf('create or replace function public.admin_daily_stats()');
    const functionEnd = baseSql.indexOf('\n$$;', functionStart) + 4;
    const adminFunction = baseSql.slice(functionStart, functionEnd);
    expect(adminFunction).toContain('public.diagnosis_daily_stats');
    expect(adminFunction).not.toContain('from public.planner_results');
    expect(adminFunction).toContain("and role = 'admin'");
  });

  it('replaces the existing cron job and hard-deletes results older than 30 days every hour', () => {
    const unscheduleIndex = retentionPolicySql.indexOf('perform cron.unschedule(existing_job_id)');
    const scheduleIndex = retentionPolicySql.indexOf('select cron.schedule(');

    expect(retentionPolicySql).toContain('select jobid');
    expect(retentionPolicySql).toContain('from cron.job');
    expect(retentionPolicySql).toContain("where jobname = 'purge-expired-planner-results'");
    expect(unscheduleIndex).toBeGreaterThan(-1);
    expect(scheduleIndex).toBeGreaterThan(unscheduleIndex);
    expect(retentionPolicySql).toContain("where created_at < now() - interval '30 days'");
    expect(retentionPolicySql).not.toContain("interval '7 days'");
    expect(retentionPolicySql).not.toContain('updated_at');
    expect(retentionPolicySql).toContain("'purge-expired-planner-results'");
    expect(retentionPolicySql).toContain("'17 * * * *'");
    expect(baseSql).toContain('create index if not exists planner_results_created_at_idx');
  });

  it('changes only planner result retention and leaves aggregate statistics and access policies untouched', () => {
    expect(retentionPolicySql).not.toContain('diagnosis_daily_stats');
    expect(retentionPolicySql).not.toContain('admin_daily_stats');
    expect(retentionPolicySql).not.toMatch(/\b(create|alter|drop)\s+(table|policy|trigger)\b/);
    expect(retentionPolicySql).not.toContain('planner_drafts');
  });

  it('does not expose the aggregate table or privileged trigger function', () => {
    expect(baseSql).toContain('alter table public.diagnosis_daily_stats enable row level security');
    expect(baseSql).toContain('revoke all on table public.diagnosis_daily_stats from authenticated');
    expect(baseSql).toContain("set search_path = ''");
    expect(baseSql).toContain('revoke all on function private.record_planner_result_diagnosis() from public');
  });
});
