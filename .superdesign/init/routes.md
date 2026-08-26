# Routes

The application is a React/Vite single-page workflow controlled by `src/App.jsx` phase state.

- Financial-health detailed report: `phase === 'fhs-report'` → `src/components/report/FhsDetailReport.jsx`
- General report: `phase === 'report'` → `src/components/report/Report.jsx`
- Summary: `phase === 'summary'` → `src/components/summary/SimpleSummaryReport.jsx`
