export default function RecordSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    }}>
      <img
        src="/rekodo-record-spinner.png"
        alt="Loading"
        style={{
          width: '165px',
          height: '165px',
          animation: 'rekodoSpin 2.4s linear infinite',
        }}
      />
      <style>{`
        @keyframes rekodoSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
