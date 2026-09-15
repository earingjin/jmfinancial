import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260915000000_add_planner_draft_screen_id.sql', import.meta.url),
  'utf8',
).toLowerCase();

describe('planner draft screen position migration', () => {
  it('adds a nullable screen_id without replacing the existing draft table or policies', () => {
    expect(sql).toContain('alter table public.planner_drafts');
    expect(sql).toContain('add column screen_id text null');
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('create policy');
  });
});
