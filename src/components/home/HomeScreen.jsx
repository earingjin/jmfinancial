import { useState } from 'react';
import homeImage from '../../assets/홈화면.webp';
import AppCopyright from '../AppCopyright';

// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ userName, onStart, onViewHistory, onSignOut, onDeleteAccount }) {
  const displayName = userName?.trim() || '고객';
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (!window.confirm('회원탈퇴하시겠습니까? 진단 결과를 포함한 모든 정보가 삭제되며 되돌릴 수 없습니다.')) return;
    setDeleteError('');
    setDeleting(true);
    const { error } = await onDeleteAccount();
    setDeleting(false);
    if (error) setDeleteError(error.message || '회원탈퇴에 실패했습니다.');
  };

  return (
    <div className="welcome-page home-welcome-page">
      <section className="welcome-shell" aria-labelledby="home-title">
        <div className="welcome-visual">
          <img src={homeImage} alt="자산의 성장을 표현한 그래프와 원화 아이콘" width="941" height="1672" decoding="async" fetchPriority="high" />
        </div>

        <div className="welcome-panel">
          <div className="home-intro">
            <h1 id="home-title">{displayName}님, 반갑습니다.</h1>
            <p className="home-tagline">
              <span>현재 자산을 진단하고</span>
              <span className="home-tagline-emphasis">미래의 여유를 설계하세요.</span>
            </p>
          </div>

          <div className="home-orientation" aria-label="자산진단 사전 안내">
            <div className="home-orientation-summary">
              <div><span aria-hidden="true">◷</span><strong>약 10~15분</strong></div>
              <div><span aria-hidden="true">✓</span><strong>6개 영역</strong></div>
              <div><span aria-hidden="true">▤</span><strong>맞춤 리포트</strong></div>
            </div>
            <ul className="home-orientation-notes">
              <li>총액만 입력해도 진단 가능</li>
              <li>항목별 세부 입력은 필요할 때만 선택</li>
              <li>중간 입력 내용 임시저장 가능</li>
              <li>진단 완료 후 맞춤 리포트 제공</li>
              <li>진단 결과 7일 후 자동 삭제</li>
            </ul>
          </div>

          <div className="welcome-actions">
            <button type="button" className="welcome-login" onClick={onStart}>자산진단 시작하기</button>
            <button type="button" className="welcome-signup" onClick={onViewHistory}>이전 결과 보기</button>
          </div>
          <div className="home-account-actions">
            <button type="button" className="home-signout" onClick={onSignOut}>로그아웃</button>
            <span className="home-account-actions-divider" aria-hidden="true">|</span>
            <button type="button" className="home-signout home-delete-account" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? '탈퇴 처리 중…' : '회원탈퇴'}
            </button>
          </div>
          {deleteError && <p className="home-delete-account-error">{deleteError}</p>}
          <AppCopyright className="welcome-copyright" />
        </div>
      </section>
    </div>
  );
}
