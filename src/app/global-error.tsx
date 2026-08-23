'use client';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07090E',
          color: '#E6EDF3',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '520px', textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              border: '1px solid #FF6B6B',
              color: '#FF6B6B',
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            Critical Failure
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', margin: '1.5rem 0 0.75rem' }}>
            TOTAL VOID
          </h1>
          <p style={{ color: '#8B949E', marginBottom: '2rem', lineHeight: 1.6 }}>
            The application failed at its deepest layer. Reload the page — or accept defeat gracefully.
          </p>
          <button
            onClick={() => retry()}
            style={{
              padding: '12px 28px',
              background: '#FF6B6B',
              color: '#07090E',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontSize: '13px',
            }}
          >
            Reload
          </button>
          {error?.digest ? (
            <p style={{ marginTop: '2rem', fontSize: '11px', color: '#484F58' }}>Ref: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
