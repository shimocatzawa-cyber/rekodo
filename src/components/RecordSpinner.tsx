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
      <img
        src="/rekodo-record-spinner.png"
        alt="Loading"
        style={{
          width: '80px',
          height: '80px',
          animation: 'rekodoSpin 2.4s linear infinite',
        }}
      />
      <p style={{
        fontFamily: 'var(--font-mono)',
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
