// BibleGate — what the app shows before the live Bible has been read, and what it
// shows if the Bible cannot be reached at all.
//
// This is the visible face of the fail-closed rule. When the Bible is unreachable
// this app has NO underwriting numbers, so it shows this instead of an analyzer.
// There is deliberately no "continue anyway" escape hatch: an offer computed from a
// stale number is worse than no offer, because it looks right.

export default function BibleGate({ loading, error, bibleUrl, onRetry }) {
  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 14 }}>
          Reading the Bible…
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 16 }}>
      <div style={{ maxWidth: 560, width: '100%', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#7f1d1d', margin: '0 0 8px' }}>
          Can’t reach the Bible — analyzer disabled
        </h1>
        <p style={{ fontSize: 14, color: '#991b1b', margin: '0 0 12px' }}>
          Every number this analyzer uses comes from the Bible, and it can’t be read
          right now. Rather than show an offer built on an out-of-date number, it’s
          showing you nothing. Nothing is broken in your deal — this is the analyzer
          refusing to guess.
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(255,255,255,0.7)', border: '1px solid #fecaca', borderRadius: 6, padding: 8, marginBottom: 16, wordBreak: 'break-all', color: '#7f1d1d' }}>
          {bibleUrl}
        </div>
        {error ? (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 12, color: '#b91c1c', cursor: 'pointer' }}>Technical detail</summary>
            <p style={{ fontSize: 12, color: '#991b1b', marginTop: 8, wordBreak: 'break-word' }}>{error.message}</p>
          </details>
        ) : null}
        <button
          type="button"
          onClick={onRetry}
          style={{ padding: '8px 16px', borderRadius: 8, background: '#b91c1c', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
