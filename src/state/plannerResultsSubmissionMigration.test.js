import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260819043621_add_planner_result_submission_id.sql', import.meta.url),
  'utf8'
).toLowerCase();

describe('planner_results submission id migration', () => {
  it('adds a nullable UUID without rewriting existing JSON results', () => {
    expect(sql).toContain('add column submission_id uuid');
    expect(sql).not.toContain('not null');
    expect(sql).not.toContain('update public.planner_results');
    expect(sql).not.toContain('assumptions_json');
  });

  it('enforces uniqueness per user while allowing the same id across users', () => {
    expect(sql).toContain('unique (user_id, submission_id)');
    expect(sql).not.toContain('unique (submission_id)');
  });
});
