export default function Loading() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        background: '#07090E',
        color: '#8B949E',
      }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          border: '2px solid #1F2733',
          borderTopColor: '#FF6B6B',
          borderRadius: '50%',
          animation: 'gk-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes gk-spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '12px', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
        Loading
      </span>
    </div>
  );
}
