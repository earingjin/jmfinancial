import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260820000000_retain_diagnosis_stats_and_purge_results.sql', import.meta.url),
  'utf8'
).toLowerCase();

describe('planner results retention migration', () => {
  it('keeps only anonymous daily diagnosis counts', () => {
    expect(sql).toContain('create table if not exists public.diagnosis_daily_stats');
    expect(sql).toContain('stat_date date primary key');
    expect(sql).toContain('diagnosis_count bigint not null');
    expect(sql).not.toMatch(/diagnosis_daily_stats[\s\S]*user_id/);
    expect(sql).not.toMatch(/diagnosis_daily_stats[\s\S]*result_json/);
    expect(sql).not.toMatch(/diagnosis_daily_stats[\s\S]*input_json/);
  });

  it('records each completed result once through an insert trigger', () => {
    expect(sql).toContain('after insert on public.planner_results');
    expect(sql).toContain("new.created_at at time zone 'asia/seoul'");
    expect(sql).toContain('diagnosis_count = public.diagnosis_daily_stats.diagnosis_count + 1');
  });

  it('moves the admin diagnosis source away from sensitive results', () => {
    const functionStart = sql.lastIndexOf('create or replace function public.admin_daily_stats()');
    const functionEnd = sql.indexOf('\n$$;', functionStart) + 4;
    const adminFunction = sql.slice(functionStart, functionEnd);
    expect(adminFunction).toContain('public.diagnosis_daily_stats');
    expect(adminFunction).not.toContain('from public.planner_results');
    expect(adminFunction).toContain("and role = 'admin'");
  });

  it('hard-deletes results older than seven days every hour', () => {
    expect(sql).toContain("where created_at < now() - interval '7 days'");
    expect(sql).toContain("'purge-expired-planner-results'");
    expect(sql).toContain("'17 * * * *'");
    expect(sql).toContain('create index if not exists planner_results_created_at_idx');
  });

  it('does not expose the aggregate table or privileged trigger function', () => {
    expect(sql).toContain('alter table public.diagnosis_daily_stats enable row level security');
    expect(sql).toContain('revoke all on table public.diagnosis_daily_stats from authenticated');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke all on function private.record_planner_result_diagnosis() from public');
  });
});
