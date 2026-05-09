// Accepts forward-compat props but ignores them (placeholder tab).
export default function CommercialTab(_props) {
  return (
    <section>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Commercial</h2>
      <p style={{ color: '#5a6a8a', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
        Reserved scaffolding for the commercial / NNN module. Spec is captured in
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3, margin: '0 4px' }}>docs/COMMERCIAL_BRIEF_V1.md</code>
        — full rent roll table, MVM 0/20/30 scenarios, NNN/NN/MG/FSG lease types with auto-recoveries,
        WALT + rollover + tenant-concentration outputs.
      </p>
      <div style={{
        padding: 16,
        border: '1px solid #d4dae8',
        borderRadius: 6,
        backgroundColor: '#fff',
        color: '#5a6a8a',
        fontSize: 13,
        lineHeight: 1.6
      }}>
        <strong style={{ color: '#1a2456', display: 'block', marginBottom: 8 }}>
          Brief in repo, build deferred
        </strong>
        The V1 spec lives at{' '}
        <code style={{ background: '#eef2fb', padding: '1px 5px', borderRadius: 3 }}>docs/COMMERCIAL_BRIEF_V1.md</code>.
        When the commercial module is implemented, it ships as a self-contained{' '}
        <code style={{ background: '#eef2fb', padding: '1px 5px', borderRadius: 3 }}>src/math/commercial.js</code>{' '}
        + an updated <code style={{ background: '#eef2fb', padding: '1px 5px', borderRadius: 3 }}>CommercialTab.jsx</code>{' '}
        — no edits to anything else in this repo, no edits to any other rei-* repo.
      </div>
    </section>
  )
}
