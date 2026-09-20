export default function Loading() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '60vh',
        padding: '3rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
      aria-busy="true"
      aria-label="Loading page content"
    >
      {/* Top Header Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' }}>
        <div
          style={{
            width: '120px',
            height: '16px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.04)',
            animation: 'gk-pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: '280px',
            height: '36px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.06)',
            animation: 'gk-pulse 1.5s ease-in-out infinite 0.1s',
          }}
        />
        <div
          style={{
            width: '420px',
            maxWidth: '100%',
            height: '18px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.03)',
            animation: 'gk-pulse 1.5s ease-in-out infinite 0.2s',
          }}
        />
      </div>

      {/* Content Grid Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
          width: '100%',
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              height: '340px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              animation: `gk-pulse 1.5s ease-in-out infinite ${n * 0.1}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes gk-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
