import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatWon } from '../../utils/format';

// SimpleSummaryReport.jsx의 formatDesignDate와 같은 용도이지만, 이 목록에서는 연도를
// 4자리로 온전히 보여줄 필요가 있어("2026.08.11") 별도로 둔다.
function formatHistoryDate(iso) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

// 이 계정으로 저장된 과거 진단 결과 목록. planner_results 테이블을 그대로 조회하며
// (RLS의 "Users can read own planner results" SELECT 정책으로 본인 행만 조회됨), 별도
// 상세 조회 API 없이 result_json을 그대로 받아 클릭 시 요약 화면에 바로 넘긴다.
export default function HistoryList({ user, onSelect, onBackHome, onStart }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [rows, setRows] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('planner_results')
        .select('id, created_at, result_json, input_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setStatus('error');
        return;
      }
      setRows(data || []);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // RLS의 "Users can delete own planner results" DELETE 정책으로 본인 행만 삭제 가능.
  // 되돌릴 수 없는 작업이라 먼저 확인을 받고, 성공하면 화면 목록에서도 바로 제거한다.
  const handleDelete = async (id) => {
    if (!window.confirm('이 진단 결과를 삭제하시겠습니까? 삭제하면 되돌릴 수 없습니다.')) return;
    setDeleteError('');
    setDeletingId(id);
    setRows((prev) => prev.filter((row) => row.id !== id));
    const { data: { session } } = await supabase.auth.getSession();
    const response = session
      ? await fetch(`/api/delete-result?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      : null;
    setDeletingId(null);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => ({})) : {};
      setDeleteError(body.error || '로그인 세션을 확인할 수 없어 서버에서 삭제하지 못했습니다.');
      return;
    }
  };

  if (status === 'loading') {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>이전 진단 결과를 불러오고 있습니다…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="error-state">
        <p>이전 결과를 불러오지 못했습니다. {errorMessage}</p>
        <button type="button" className="btn-primary" onClick={onBackHome}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="home-card history-card">
      <button type="button" className="history-back-btn" onClick={onBackHome}>
        ← 홈으로
      </button>
      <h2 className="home-title history-title">이전 결과 보기</h2>
      <p className="history-retention-notice">
        진단 결과는 완료 후 7일간 보관되며, 이후 자동 삭제됩니다.
      </p>
      {deleteError && <p className="history-delete-error">{deleteError}</p>}

      {rows.length === 0 ? (
        <div className="history-empty">
          <p>아직 진단 결과가 없습니다. 첫 진단을 시작해 보세요.</p>
          <button type="button" className="btn-primary" onClick={onStart}>
            자산진단 시작하기
          </button>
        </div>
      ) : (
        <ul className="history-list">
          {rows.map((row) => (
            <li key={row.id} className="history-row">
              <button type="button" className="history-item" onClick={() => onSelect(row)}>
                <span className="history-item-date">{formatHistoryDate(row.created_at)}</span>
                <span className="history-item-sub">순자산 {formatWon(row.result_json?.aggregates?.netWorth)}</span>
              </button>
              <button
                type="button"
                className="history-delete-btn"
                onClick={() => handleDelete(row.id)}
                disabled={deletingId === row.id}
                aria-label="이 진단 결과 삭제"
              >
                {deletingId === row.id ? '삭제 중…' : '삭제'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
