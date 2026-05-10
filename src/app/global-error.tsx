'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, height: '100vh', display: 'grid', placeItems: 'center',
        background: '#15241a', color: '#f5efe2', fontFamily: 'system-ui, sans-serif',
        padding: 24,
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.5em', opacity: 0.7, textTransform: 'uppercase', marginBottom: 12 }}>
            StarClan whispers...
          </div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 28, margin: '0 0 12px' }}>
            The warriors have discovered an issue.
          </h1>
          <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 24 }}>
            Something tangled in the brambles. Try returning to the clearing.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#b65a2a', color: '#f5efe2', border: 'none',
              padding: '12px 24px', borderRadius: 12, fontSize: 16, cursor: 'pointer',
              fontFamily: 'Cinzel, serif',
            }}
          >
            Try Again
          </button>
          {error?.digest && (
            <div style={{ fontSize: 10, opacity: 0.4, marginTop: 16, fontFamily: 'monospace' }}>
              {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
