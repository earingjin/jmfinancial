import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../supabase/migrations/20260908013014_account_reset_transaction.sql', import.meta.url);

describe('account reset transaction migration', () => {
  it('atomically covers every user-linked data table and retains anonymous diagnosis stats', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('create or replace function public.delete_planner_user_data');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('delete from public.admin_notes');
    expect(sql).toContain('delete from public.admin_audit_logs');
    expect(sql).toContain('delete from public.planner_results');
    expect(sql).toContain('delete from public.planner_drafts');
    expect(sql).toContain('update public.profiles');
    expect(sql).not.toMatch(/delete from public\.diagnosis_daily_stats/);
    expect(sql).not.toMatch(/delete from auth\.users/);
  });

  it('is callable only by service_role and scopes every delete to the supplied user', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('revoke all on function public.delete_planner_user_data(uuid, boolean) from public');
    expect(sql).toContain('from anon');
    expect(sql).toContain('from authenticated');
    expect(sql).toContain('grant execute on function public.delete_planner_user_data(uuid, boolean) to service_role');
    expect(sql.match(/p_user_id/g)?.length).toBeGreaterThanOrEqual(8);
  });
});
