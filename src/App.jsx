import { useEffect, useRef, useState } from 'react';
import { FormProvider } from './state/FormContext';
import { AuthProvider } from './state/AuthContext';
import { useAuth } from './state/authState';
import AuthGate from './components/auth/AuthGate';
import WelcomeScreen from './components/welcome/WelcomeScreen';
import AdminDashboard from './components/admin/AdminDashboard';
import HomeScreen from './components/home/HomeScreen';
import HistoryList from './components/home/HistoryList';
import Wizard from './components/wizard/Wizard';
import Report from './components/report/Report';
import SimpleSummaryReport from './components/summary/SimpleSummaryReport';
import AppCopyright from './components/AppCopyright';
import { deobfuscate } from './utils/obfuscate';
import { supabase } from './lib/supabaseClient';
import { clearDraftSessionCache, deleteDraft, fetchDraftOnce, migrateLegacyDraft, readLegacyLocalDraft, removeLegacyLocalDraft, validateDraft } from './state/draftStorage';
import { completePlannerSubmission, createSubmissionId } from './services/plannerSubmission';
import './styles/tokens.css';
import './styles/app.css';

function AppContent({ initialDraft = null, startWithWizard = false }) {
  const { user, signOut } = useAuth();
  const [phase, setPhase] = useState(startWithWizard ? 'wizard' : 'home'); // 'home' | 'wizard' | 'loading' | 'summary' | 'report' | 'error' | 'history'
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [wizardResume, setWizardResume] = useState(false);
  // 지금 보고 있는 result가 방금 새로 진단한 것인지('new'), 과거 목록에서 열어본 것인지('history')
  // 구분한다 - 요약 화면의 "뒤로가기"가 어디로 돌아가야 하는지를 이 값으로 분기한다.
  const [resultSource, setResultSource] = useState('new');
  // "7. 대응방안"에서 사용자가 실제로 켠 시나리오/직접 입력한 값(나이·기간·목표금액 등)을 리포트의
  // 마지막 페이지(AssetManagementOptionsPage)에서 그대로 보여주기 위해 보관한다. 서버 계산 결과와
  // 달리 이 값은 계산이 아니라 사용자가 입력한 그대로를 표시하는 용도라 formData에서 바로 가져온다.
  const [submittedScenariosInput, setSubmittedScenariosInput] = useState(null);
  const pendingSubmissionRef = useRef(null);
  const submissionPromiseRef = useRef(null);

  const finishSubmission = async () => {
    if (submissionPromiseRef.current) return submissionPromiseRef.current;
    const pending = pendingSubmissionRef.current;
    if (!pending) return;
    submissionPromiseRef.current = (async () => {
      setPhase('loading');
      try {
        const completedResult = await completePlannerSubmission(pending, user);
        setResult(completedResult);
        pendingSubmissionRef.current = null;
        setPhase('summary');
      } catch {
        setErrorMessage(pending.resultSaved
          ? '진단 결과는 저장되었지만 임시 초안 정리에 실패했습니다. 다시 시도해 주세요.'
          : '진단 결과 저장에 실패했습니다. 입력 내용과 임시 초안은 유지됩니다.');
        setPhase('save-error');
      } finally {
        submissionPromiseRef.current = null;
      }
    })();
    return submissionPromiseRef.current;
  };

  const handleSubmit = async (formData) => {
    setPhase('loading');
    setErrorMessage('');
    setResultSource('new');
    setSubmittedScenariosInput(formData?.scenarios ?? null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');

      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.status === 401) {
        await signOut();
        throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '계산에 실패했습니다.');
      }
      const body = await res.json();
      const data = deobfuscate(body.payload);
      pendingSubmissionRef.current = { formData, data, resultSaved: false, submissionId: createSubmissionId() };
      await finishSubmission();
    } catch (err) {
      setErrorMessage(err.message || '알 수 없는 오류가 발생했습니다.');
      setPhase('error');
    }
  };

  const restart = () => {
    setResult(null);
    setResultSource('new');
    setWizardResume(false);
    setPhase('wizard');
  };

  // 결과 요약 화면의 "뒤로가기": 처음부터 다시 시작하는 게 아니라 방금 작성한 마법사의
  // 마지막 단계로 돌아간다. formData는 FormProvider가 계속 들고 있어 입력값이 그대로 남는다.
  const backToWizard = () => {
    setWizardResume(true);
    setPhase('wizard');
  };

  // 요약 화면의 "뒤로가기"는 지금 보고 있는 result가 신규 진단인지 과거 결과 조회인지에 따라
  // 목적지가 다르다 - 신규 진단은 그대로 마법사 마지막 단계로, 과거 결과는 히스토리 목록으로.
  const handleSummaryBack = () => {
    if (resultSource === 'history') {
      setPhase('history');
    } else {
      backToWizard();
    }
  };

  const goToReport = () => {
    window.scrollTo(0, 0);
    setPhase('report');
  };

  const goHome = () => setPhase('home');

  const startDiagnosis = () => {
    setResultSource('new');
    setWizardResume(false);
    setPhase('wizard');
  };

  const viewHistory = () => setPhase('history');

  // 히스토리 목록에서 항목을 클릭했을 때 - 새로 계산하지 않고 저장된 result_json을 그대로
  // 요약 화면에 넘긴다(계산 API를 다시 호출하지 않음).
  const openPastResult = (row) => {
    setResult(row.result_json);
    setResultSource('history');
    setPhase('summary');
  };

  const isDiagnosisPhase = phase === 'wizard' || phase === 'loading';
  // 홈/이전 결과 화면은 배경까지는 진단 화면과 맞추지 않고, 헤더(맨 위 부분)만 진단 화면과
  // 같은 디자인으로 통일한다.
  const useDiagnosisHeader = isDiagnosisPhase || phase === 'home' || phase === 'history';

  return (
    <div className={`app-shell${isDiagnosisPhase ? ' app-shell--diagnosis' : ''}`}>
      {phase !== 'report' && phase !== 'summary' && phase !== 'home' && (
        <header className={`app-header${useDiagnosisHeader ? ' app-header--diagnosis' : ''}`}>
          <div className="app-header-account">
            {phase === 'wizard' && (
              <button type="button" className="app-header-home-btn" onClick={goHome}>
                홈으로
              </button>
            )}
            <button type="button" className="app-header-signout" onClick={signOut}>
              로그아웃
            </button>
          </div>
          <div className="app-brand">JM FINANCIAL PLANNER</div>
          <div className="app-brand-sub">제이엠 자산관리 플래너</div>
        </header>
      )}

      <main className={`app-main${phase === 'report' ? ' report-print-mode' : ''}${phase === 'home' ? ' app-main--home' : ''}`}>
        {phase === 'home' && (
          <HomeScreen
            userName={user?.user_metadata?.name}
            onStart={startDiagnosis}
            onViewHistory={viewHistory}
            onSignOut={signOut}
          />
        )}

        {phase === 'history' && (
          <HistoryList user={user} onSelect={openPastResult} onBackHome={goHome} onStart={startDiagnosis} />
        )}

        <FormProvider userId={user.id} initialDraft={initialDraft}>
          {phase === 'wizard' && <Wizard onSubmit={handleSubmit} startAtLastStep={wizardResume} initialStep={initialDraft?.step_index || 0} />}
        </FormProvider>

        {phase === 'loading' && (
          <div className="loading-state">
            <div className="spinner" />
            <p>입력하신 정보를 바탕으로 재무진단을 계산하고 있습니다…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="error-state">
            <p>{errorMessage}</p>
            <button type="button" className="btn-primary" onClick={restart}>
              처음부터 다시 입력하기
            </button>
          </div>
        )}

        {phase === 'save-error' && (
          <div className="error-state">
            <p>{errorMessage}</p>
            <button type="button" className="btn-primary" onClick={() => void finishSubmission()}>
              다시 저장
            </button>
            <button type="button" className="btn-secondary" onClick={backToWizard}>
              입력 화면으로 돌아가기
            </button>
          </div>
        )}

        {phase === 'summary' && result && (
          <SimpleSummaryReport
            result={result}
            onBack={handleSummaryBack}
            onHome={goHome}
            onDownload={goToReport}
            onShare={goToReport}
          />
        )}

        {phase === 'report' && result && (
          <Report
            result={result}
            onRestart={restart}
            onBack={() => setPhase('summary')}
            clientName={user?.user_metadata?.name}
            scenariosInput={submittedScenariosInput}
          />
        )}
      </main>
      {phase !== 'report' && phase !== 'home' && <AppCopyright />}
    </div>
  );
}

function AuthGatedApp({ authView, onAuthViewChange }) {
  const { user, loading } = useAuth();
  const [draftDecision, setDraftDecision] = useState(null);
  const [draftLoad, setDraftLoad] = useState({ status: 'idle', source: null, draft: null, message: null });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setDraftLoad({ status: 'idle', source: null, draft: null, message: null });
      setDraftDecision(null);
      return;
    }
    let cancelled = false;
    setDraftLoad({ status: 'loading', source: null, draft: null, message: null });
    fetchDraftOnce(user.id).then((remoteDraft) => {
      if (cancelled) return;
      if (remoteDraft) {
        const validation = validateDraft(remoteDraft);
        setDraftLoad(validation.valid
          ? { status: 'choice', source: 'remote', draft: remoteDraft, message: null }
          : { status: 'incompatible', source: 'remote', draft: remoteDraft, message: validation.reason });
        return;
      }
      const legacyDraft = readLegacyLocalDraft(user.id);
      if (!legacyDraft) {
        setDraftLoad({ status: 'ready', source: null, draft: null, message: null });
        return;
      }
      const validation = validateDraft(legacyDraft);
      if (validation.valid) {
        setDraftLoad({ status: 'choice', source: 'legacy', draft: legacyDraft, message: null });
      } else {
        removeLegacyLocalDraft(user.id);
        setDraftLoad({ status: 'incompatible', source: 'legacy', draft: null, message: validation.reason });
      }
    }).catch(() => {
      if (!cancelled) setDraftLoad({ status: 'error', source: null, draft: null, message: '저장된 초안을 불러오지 못했습니다.' });
    });
    return () => { cancelled = true; };
  }, [user?.id, loadAttempt]);

  const continueDraft = async () => {
    if (draftLoad.source === 'remote') {
      setDraftDecision({ userId: user.id, draft: draftLoad.draft });
      return;
    }
    setDraftLoad((state) => ({ ...state, status: 'loading' }));
    try {
      const migrated = await migrateLegacyDraft(user.id, draftLoad.draft);
      setDraftDecision({ userId: user.id, draft: migrated });
    } catch {
      setDraftLoad((state) => ({ ...state, status: 'error', message: '기존 초안을 이전하지 못했습니다. 다시 시도해 주세요.' }));
    }
  };

  const startNew = async () => {
    setDraftLoad((state) => ({ ...state, status: 'loading' }));
    try {
      if (draftLoad.source === 'remote') await deleteDraft(user.id);
      removeLegacyLocalDraft(user.id);
      setDraftDecision({ userId: user.id, draft: null });
    } catch {
      setDraftLoad((state) => ({ ...state, status: 'error', message: '기존 초안을 삭제하지 못했습니다. 다시 시도해 주세요.' }));
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>불러오는 중…</p>
      </div>
    );
  }

  if (!user) {
    if (authView === 'welcome') {
      return (
        <WelcomeScreen
          onLogin={() => onAuthViewChange('login')}
          onSignup={() => onAuthViewChange('signup')}
        />
      );
    }
    return (
      <AuthGate
        key={authView}
        initialMode={authView}
        allowSignup={false}
        secondaryAction={{ label: '← 뒤로가기', onClick: () => onAuthViewChange('welcome') }}
      />
    );
  }

  const currentDecision = draftDecision?.userId === user.id ? draftDecision : null;
  if (!currentDecision && (draftLoad.status === 'idle' || draftLoad.status === 'loading')) {
    return <div className="loading-state"><div className="spinner" /><p>작성 중인 초안을 확인하는 중…</p></div>;
  }
  if (!currentDecision && draftLoad.status === 'choice') {
    return (
      <div className="draft-choice">
        <div className="draft-choice-card">
          <h2>{draftLoad.source === 'legacy' ? '이 브라우저에 기존 초안이 있습니다' : '작성 중인 초안이 있습니다'}</h2>
          <p>{draftLoad.source === 'legacy' ? '기존 로컬 초안을 Supabase로 이전해 다른 기기에서도 이어서 작성하시겠습니까?' : '다른 기기에서 저장한 내용까지 포함해 이어서 작성할 수 있습니다.'}</p>
          <button type="button" className="btn-primary" onClick={() => void continueDraft()}>이어서 입력</button>
          <button type="button" className="btn-secondary" onClick={() => void startNew()}>새로 입력</button>
        </div>
      </div>
    );
  }

  if (!currentDecision && draftLoad.status === 'incompatible') {
    return <div className="draft-choice"><div className="draft-choice-card"><h2>초안을 이어서 사용할 수 없습니다</h2><p>{draftLoad.message} 새 입력으로 시작해 주세요.</p><button type="button" className="btn-primary" onClick={() => void startNew()}>새로 입력</button></div></div>;
  }

  if (!currentDecision && draftLoad.status === 'error') {
    return <div className="draft-choice"><div className="draft-choice-card"><h2>초안을 확인하지 못했습니다</h2><p>{draftLoad.message}</p><button type="button" className="btn-primary" onClick={() => { clearDraftSessionCache(user.id); setLoadAttempt((value) => value + 1); }}>다시 시도</button></div></div>;
  }

  return <AppContent initialDraft={currentDecision?.draft || null} startWithWizard={Boolean(currentDecision)} />;
}

function AdminRoute() {
  const { user, loading, signOut } = useAuth();
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? null);
        setRoleLoading(false);
      });
  }, [user]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>불러오는 중…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthGate title="관리자 로그인" allowSignup={false} />;
  }

  if (role !== 'admin') {
    return (
      <AuthGate
        title="관리자 로그인"
        allowSignup={false}
        noticeMessage={`현재 ${user.email} 계정은 관리자 권한이 없습니다. 다른 관리자 계정으로 로그인해 주세요.`}
        secondaryAction={{ label: '로그아웃', onClick: signOut }}
      />
    );
  }

  return <AdminDashboard onSignOut={signOut} />;
}

export default function App() {
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const resolveAuthView = () => {
    if (window.location.pathname === '/login') return 'login';
    if (window.location.pathname === '/signup') return 'signup';
    return 'welcome';
  };
  const [authView, setAuthView] = useState(resolveAuthView);

  useEffect(() => {
    const handlePopState = () => setAuthView(resolveAuthView());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeAuthView = (nextView) => {
    const nextPath = nextView === 'welcome' ? '/' : `/${nextView}`;
    window.history.pushState({}, '', nextPath);
    setAuthView(nextView);
    window.scrollTo(0, 0);
  };

  return (
    <AuthProvider>
      {isAdminRoute ? <AdminRoute /> : <AuthGatedApp authView={authView} onAuthViewChange={changeAuthView} />}
    </AuthProvider>
  );
}
