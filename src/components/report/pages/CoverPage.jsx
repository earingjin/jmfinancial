import heroImage from '../../../assets/리포트 표지 디자인.png';
import jmCareerLogo from '../../../assets/제이엠커리어 로고.png';
import aiDataCenterLogo from '../../../assets/ai데이터센터로고.png';
import { REPORT_DISCLAIMERS } from './legalNotices';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default function CoverPage({ generatedAt, clientName, title, titleSuffix, subtitle }) {
  const date = generatedAt ? new Date(generatedAt) : new Date();

  return (
    <div className="page cover-page">
      <img className="cover-bg" src={heroImage} alt="성장 그래프를 배경으로 한 리포트 표지 디자인" />
      <div className="cover-frame">
        <div className="cover-topbar">
          <img className="cover-logo-img" src={jmCareerLogo} alt="제이엠커리어" />
        </div>

        <h1 className="cover-title">
          <span className="cover-title-main">{title || '제이엠 자산관리 플래너'}</span>
          {titleSuffix && <span className="cover-title-suffix">{titleSuffix}</span>}
          <br /><span className="cover-title-subtitle">{subtitle || 'JM Financial Planner'}</span>
        </h1>

        <div className="cover-date-badge">Date&nbsp;&nbsp;{formatDate(date)}</div>

        <div className="cover-spacer" />

        <div className="cover-client">Client Name : <b>{clientName || '고객'}</b></div>

        <div className="cover-disclaimer">
          <ul>
            {REPORT_DISCLAIMERS.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      </div>
      <div className="cover-footer">
        <img className="footer-logo" src={aiDataCenterLogo} alt="AI 데이터센터" />
        <span className="cover-copyright">Copyright &copy; {date.getFullYear()}. JMCAREER. All rights reserved.</span>
      </div>
    </div>
  );
}
