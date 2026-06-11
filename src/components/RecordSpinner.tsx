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
        lineHeight: 1.6,
      }}>
        Your collection is talking.<br />Give us a moment.
      </p>
      <style>{`
        @keyframes rekodoSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
