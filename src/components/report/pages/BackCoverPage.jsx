import heroImage from '../../../assets/리포트 표지 디자인.png';
import jmCareerLogo from '../../../assets/제이엠커리어 로고.png';
import aiDataCenterLogo from '../../../assets/ai데이터센터로고.png';
import { REPORT_DISCLAIMERS } from './legalNotices';

export default function BackCoverPage({ generatedAt }) {
  const year = (generatedAt ? new Date(generatedAt) : new Date()).getFullYear();

  return (
    <div className="page cover-page back-cover-page">
      <img className="cover-bg" src={heroImage} alt="성장 그래프를 배경으로 한 리포트 표지 디자인" />
      <div className="cover-frame">
        <div className="cover-topbar">
          <img className="cover-logo-img" src={jmCareerLogo} alt="제이엠커리어" />
        </div>

        <h2 className="backcover-title"></h2>

        <div className="cover-spacer" />

        <div className="backcover-quote">
          <div className="backcover-quote-en">&quot;Small seeds create great opportunities&quot;</div>
          <div className="backcover-quote-kr">&quot;작은 씨앗이 거대한 기회를 만든다.&quot;</div>
          <div className="backcover-quote-src">-잭과 콩나무(Jack and the Beanstalk) 이야기-</div>
        </div>

        <div className="cover-spacer" />

        <div className="cover-disclaimer">
          <ul>
            {REPORT_DISCLAIMERS.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="backcover-contact">
            연구개발: JMCAREER AI RE:WORKCENTER &nbsp;|&nbsp; CONTACT US : happylife@jmcareer.co.kr
          </div>
        </div>
      </div>
      <div className="cover-footer">
        <img className="footer-logo" src={aiDataCenterLogo} alt="AI 데이터센터" />
        <span className="cover-copyright">Copyright &copy; {year}. JMCAREER. All rights reserved.</span>
      </div>
    </div>
  );
}
