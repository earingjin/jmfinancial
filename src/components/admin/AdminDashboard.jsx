import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard({ onSignOut }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('admin_daily_stats').then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setRows(data);
    });
  }, []);

  const totalSignups = rows?.reduce((sum, r) => sum + r.signup_count, 0) ?? 0;
  const totalDiagnoses = rows?.reduce((sum, r) => sum + r.diagnosis_count, 0) ?? 0;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <div className="app-brand">JM FINANCIAL PLANNER</div>
          <h1 className="admin-title">관리자 대시보드</h1>
        </div>
        <button type="button" className="app-header-signout admin-signout" onClick={onSignOut}>
          로그아웃
        </button>
      </header>

      <div className="admin-summary">
        <div className="admin-stat">
          <span className="admin-stat-label">총 가입자 수</span>
          <span className="admin-stat-value">{totalSignups}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">총 진단 건수</span>
          <span className="admin-stat-value">{totalDiagnoses}</span>
        </div>
      </div>

      {error && <p className="auth-error">데이터를 불러오지 못했습니다: {error}</p>}

      <h3 className="ss-section-title" style={{ margin: '0 0 10px' }}>날짜별 현황</h3>
      <table className="grade-table compact">
        <thead>
          <tr>
            <th>날짜</th>
            <th style={{ textAlign: 'right' }}>가입자 수</th>
            <th style={{ textAlign: 'right' }}>진단 건수</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.stat_date}>
              <td>{r.stat_date}</td>
              <td className="num" style={{ textAlign: 'right' }}>{r.signup_count}</td>
              <td className="num" style={{ textAlign: 'right' }}>{r.diagnosis_count}</td>
            </tr>
          ))}
          {rows && rows.length === 0 && (
            <tr><td colSpan={3}>아직 데이터가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
