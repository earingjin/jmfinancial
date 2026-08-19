import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../supabase/migrations/20260819000000_create_planner_drafts.sql', import.meta.url), 'utf8').toLowerCase();

describe('planner_drafts migration security', () => {
  it('enables RLS and scopes every operation to authenticated row owners', () => {
    expect(sql).toContain('alter table public.planner_drafts enable row level security');
    expect(sql.match(/create policy/g)).toHaveLength(4);
    expect(sql.match(/\(select auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
    expect(sql).not.toContain('service_role');
    expect(sql).not.toContain('admin');
  });

  it('uses user_id as the single-row primary key and grants no anon access', () => {
    expect(sql).toContain('user_id uuid primary key references auth.users(id) on delete cascade');
    expect(sql).toContain('revoke all on table public.planner_drafts from anon');
  });
});
