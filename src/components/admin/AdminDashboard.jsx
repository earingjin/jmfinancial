import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard({ onSignOut }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  useEffect(() => {
    supabase.rpc('admin_daily_stats').then(({ data, error: err }) => {
      if (err) setError('관리자 통계를 불러오지 못했습니다.');
      else setRows(data);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      setUsersLoading(true);
      setUsersError('');
      try {
        const { data } = await supabase.auth.getSession();
        const response = await fetch(`/api/admin-users?page=${userPage}`, {
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        });
        if (!response.ok) throw new Error('회원 정보를 불러오지 못했습니다.');
        const result = await response.json();
        if (!cancelled) {
          setUsers((previous) => userPage === 1 ? result.users : [...previous, ...result.users]);
          setHasMoreUsers(result.hasMore);
        }
      } catch {
        if (!cancelled) setUsersError('회원 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }
    void loadUsers();
    return () => { cancelled = true; };
  }, [userPage]);

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

      {error && <p className="auth-error">{error}</p>}

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

      <h3 className="ss-section-title" style={{ margin: '24px 0 10px' }}>회원별 소속 기업</h3>
      {usersError && <p className="auth-error">{usersError}</p>}
      <table className="grade-table compact">
        <thead><tr><th>가입일</th><th>이름</th><th>소속 기업</th></tr></thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.createdAt?.slice(0, 10)}</td>
              <td>{user.name || '미입력'}</td>
              <td>{user.company || '미입력'}</td>
            </tr>
          ))}
          {!usersLoading && users.length === 0 && (
            <tr><td colSpan={3}>회원 정보가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
      {hasMoreUsers && (
        <button type="button" className="btn-secondary" disabled={usersLoading} onClick={() => setUserPage((page) => page + 1)}>
          {usersLoading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}
