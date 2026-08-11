import { useEffect, useState } from 'react';
import { FormProvider } from './state/FormContext';
import { AuthProvider } from './state/AuthContext';
import { useAuth } from './state/authState';
import AuthGate from './components/auth/AuthGate';
import AdminDashboard from './components/admin/AdminDashboard';
import HomeScreen from './components/home/HomeScreen';
import HistoryList from './components/home/HistoryList';
import Wizard from './components/wizard/Wizard';
import Report from './components/report/Report';
import SimpleSummaryReport from './components/summary/SimpleSummaryReport';
import AppCopyright from './components/AppCopyright';
import { deobfuscate } from './utils/obfuscate';
import { supabase } from './lib/supabaseClient';
import './styles/tokens.css';
import './styles/app.css';

async function savePlannerResult(user, formData, result) {
  const { error } = await supabase.from('planner_results').insert({
    user_id: user.id,
    // v2: 지표 응답에 rawValue/displayValue/notCalculable/reason 필드가 추가되고, 분모 0(N/A) 처리 방식이
    // 바뀌었다(0%로 위장하지 않고 notCalculable로 명시). 과거 저장된 v1 레코드와 형태가 다르므로 구분한다.
    schema_version: 'v2',
    input_json: formData,
    result_json: result,
    assumptions_json: {
      assumedReturnRate: formData?.basic?.assumedReturnRate ?? 3,
      generalInflationRate: 4.1,
    },
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('진단 결과 저장 실패:', error.message);
  }
}

function AppContent() {
  const { user, signOut } = useAuth();
  const [phase, setPhase] = useState('home'); // 'home' | 'wizard' | 'loading' | 'summary' | 'report' | 'error' | 'history'
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
      if (typeof window !== 'undefined') window.__DEBUG_RESULT = data;
      setResult(data);
      setPhase('summary');
      savePlannerResult(user, formData, data);
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
      {phase !== 'report' && phase !== 'summary' && (
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

      <main className={`app-main${phase === 'report' ? ' report-print-mode' : ''}`}>
        {phase === 'home' && <HomeScreen onStart={startDiagnosis} onViewHistory={viewHistory} />}

        {phase === 'history' && (
          <HistoryList user={user} onSelect={openPastResult} onBackHome={goHome} onStart={startDiagnosis} />
        )}

        <FormProvider>
          {phase === 'wizard' && <Wizard onSubmit={handleSubmit} startAtLastStep={wizardResume} />}
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

        {phase === 'summary' && result && (
          <SimpleSummaryReport
            result={result}
            onBack={handleSummaryBack}
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
      {phase !== 'report' && <AppCopyright />}
    </div>
  );
}

function AuthGatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>불러오는 중…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return <AppContent />;
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

  return (
    <AuthProvider>
      {isAdminRoute ? <AdminRoute /> : <AuthGatedApp />}
    </AuthProvider>
  );
}
