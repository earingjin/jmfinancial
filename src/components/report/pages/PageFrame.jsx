import aiDataCenterLogo from '../../../assets/ai데이터센터로고.png';

export default function PageFrame({ eyebrow, title, pageNumber, totalPages, children, contentClassName = '', plan = 'Standard' }) {
  return (
    <div className="page">
      <div className="page-vine-bg" aria-hidden="true" />
      <div className={`page-pad ${contentClassName}`}>
        <div className="masthead">
          <span className="masthead-kr">제이엠 자산관리 플래너</span>
          <span className="masthead-en">JM Financial Planner ({plan})</span>
        </div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className="section-title">{title}</h2>}
        {children}
      </div>
      <div className="page-footer">
        <img className="footer-logo" src={aiDataCenterLogo} alt="AI 데이터센터" />
        <span className="footer-copyright">
          Copyright &copy; {new Date().getFullYear()}. JMCAREER. All rights reserved.
          <span className="footer-pageno"> &nbsp;|&nbsp; {String(pageNumber).padStart(2, '0')} / {totalPages}</span>
        </span>
      </div>
    </div>
  );
}
