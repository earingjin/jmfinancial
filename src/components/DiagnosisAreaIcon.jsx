const ICON_PATHS = {
  income: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h5M16 9v6M13 12h6" /></>,
  expense: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 15h4M15 13l2 2 3-3" /></>,
  savings: <><path d="M5 11c1-3 4-5 8-5 4.5 0 7 2.5 7 6 0 2.4-1.4 4.3-4 5.3V20h-3v-2H9v2H6v-3.2A6.2 6.2 0 0 1 4 14H2v-3h3Z" /><path d="M14 9h2M8 6 7 3h4" /></>,
  assets: <><path d="M4 19V9h4v10M10 19V5h4v14M16 19v-7h4v7M2 19h20" /></>,
  debt: <><path d="M6 3h10l3 3v15H6Z" /><path d="M16 3v4h4M9 11h7M9 15h7" /></>,
  netWorth: <><path d="M12 4v16M6 20h12M4 7h16M7 7l-4 7h8L7 7ZM17 7l-4 7h8l-4-7Z" /></>,
};

export default function DiagnosisAreaIcon({ type, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICON_PATHS[type]}
    </svg>
  );
}
