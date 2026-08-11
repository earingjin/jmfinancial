export default function PresenceField({ label, present, onChange, presentLabel = '있음', absentLabel = '없음' }) {
  return (
    <div className="field" style={{ marginBottom: 16 }}>
      <span className="field-label">{label}</span>
      <div className="radio-group" style={{ marginTop: 6 }}>
        <button type="button" className={`radio-pill ${present ? 'is-active' : ''}`} onClick={() => onChange(true)}>
          {presentLabel}
        </button>
        <button type="button" className={`radio-pill ${!present ? 'is-active' : ''}`} onClick={() => onChange(false)}>
          {absentLabel}
        </button>
      </div>
    </div>
  );
}
