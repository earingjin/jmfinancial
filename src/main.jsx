import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AppFallbackScreen from './components/AppFallbackScreen.jsx'
import { supabaseConfigured } from './lib/supabaseClient.js'

// A10: 필수 환경변수가 없으면(supabaseConfigured=false) <App/>은 렌더링 트리 곳곳에서 supabase를
// 바로 사용하므로 mount 자체를 시도하지 않고 안전한 안내 화면만 보여준다 - App 내부를 null-체크로
// 리팩터링하지 않는다. A9: 그 외 예상하지 못한 렌더링 오류는 ErrorBoundary가 흰 화면 대신
// 안내 화면으로 대체한다.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {supabaseConfigured ? (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    ) : (
      <AppFallbackScreen message="서비스 설정 문제로 현재 이용할 수 없습니다." />
    )}
  </StrictMode>,
)
