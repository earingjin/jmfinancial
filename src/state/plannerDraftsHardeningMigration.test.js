import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData.js';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260819044000_harden_planner_drafts.sql', import.meta.url),
  'utf8',
).toLowerCase();

describe('planner_drafts hardening migration', () => {
  it('requires object-shaped form data within the existing API input limit', () => {
    expect(sql).toContain("check (jsonb_typeof(form_data) = 'object') not valid");
    expect(sql).toContain('check (length(form_data::text) <= 200000) not valid');
    expect(JSON.stringify(initialFormData).length).toBeLessThan(200_000);
  });

  it('sets updated_at from the database on every insert and update', () => {
    expect(sql).toContain('before insert or update on public.planner_drafts');
    expect(sql).toContain('new.updated_at = now()');
    expect(sql).toContain("set search_path = ''");
  });
});
