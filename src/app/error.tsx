'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#07090E',
        color: '#E6EDF3',
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
          System Failure
        </span>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', margin: '1.5rem 0 0.75rem', letterSpacing: '-0.02em' }}>
          SOMETHING BROKE
        </h1>
        <p style={{ color: '#8B949E', marginBottom: '2rem', lineHeight: 1.6 }}>
          The void swallowed this page mid-render. It happens to the best of us — and the worst of servers.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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
            Try Again
          </button>
          <Link
            href="/"
            style={{
              padding: '12px 28px',
              background: 'transparent',
              color: '#E6EDF3',
              border: '1px solid #30363D',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            Homepage
          </Link>
        </div>
        {error?.digest ? (
          <p style={{ marginTop: '2rem', fontSize: '11px', color: '#484F58' }}>Ref: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
