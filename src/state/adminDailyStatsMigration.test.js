import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260819043325_fix_admin_daily_stats_kst.sql', import.meta.url),
  'utf8'
).toLowerCase();

const koreaDate = (iso) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(iso));

describe('admin_daily_stats KST migration', () => {
  it('preserves the response columns and security boundary', () => {
    expect(sql).toContain('returns table (\n  stat_date date,\n  signup_count bigint,\n  diagnosis_count bigint');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("and role = 'admin'");
    expect(sql).toContain('revoke execute on function public.admin_daily_stats() from public');
    expect(sql).toContain('revoke execute on function public.admin_daily_stats() from anon');
    expect(sql).toContain('grant execute on function public.admin_daily_stats() to authenticated');
  });

  it('groups both source tables by their Asia/Seoul calendar date', () => {
    expect(sql.match(/\(created_at at time zone 'asia\/seoul'\)::date/g)).toHaveLength(2);
    expect(sql).not.toContain('created_at::date');
  });

  it('classifies UTC timestamps across the Korean midnight boundary', () => {
    expect(koreaDate('2026-08-19T14:59:59.999Z')).toBe('2026-08-19');
    expect(koreaDate('2026-08-19T15:00:00.000Z')).toBe('2026-08-20');
  });
});
