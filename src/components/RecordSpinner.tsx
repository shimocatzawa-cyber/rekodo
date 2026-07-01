export default function RecordSpinner() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      gap: '20px',
    }}>
      <svg
        viewBox="0 0 80 80"
        width="80"
        height="80"
        aria-hidden="true"
        style={{ animation: 'rekodoSpin 2.4s linear infinite', display: 'block' }}
      >
        <circle cx="40" cy="40" r="39" fill="#1a1a1a" />
        <circle cx="40" cy="40" r="33" fill="none" stroke="#272727" strokeWidth="1" />
        <circle cx="40" cy="40" r="27" fill="none" stroke="#272727" strokeWidth="1" />
        <circle cx="40" cy="40" r="21" fill="none" stroke="#272727" strokeWidth="1" />
        <circle cx="40" cy="40" r="16" fill="#f2ede4" />
        <text
          x="40" y="44"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="12"
          fill="#1a1a1a"
        >
          ō
        </text>
        <circle cx="40" cy="40" r="2" fill="#1a1a1a" />
      </svg>
      <p style={{
        fontFamily: 'var(--font-dm-mono), monospace',
        fontSize: '0.7rem',
        letterSpacing: '0.06em',
        color: '#999999',
        margin: 0,
        textAlign: 'center',
      }}>
        Rekōdo is thinking
        <span className="thinking-dot">.</span>
        <span className="thinking-dot">.</span>
        <span className="thinking-dot">.</span>
      </p>
      <style>{`
        @keyframes rekodoSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes thinking-dot-pulse {
          0%, 66%, 100% { opacity: 0.2; }
          33%            { opacity: 1; }
        }
        .thinking-dot { display: inline-block; }
        .thinking-dot:nth-child(1) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0s; }
        .thinking-dot:nth-child(2) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0.4s; }
        .thinking-dot:nth-child(3) { animation: thinking-dot-pulse 1.2s ease-in-out infinite 0.8s; }
      `}</style>
    </div>
  )
}
