import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BibleGate from './components/BibleGate.jsx'
import { createBibleClient } from 'shared-underwriting-standards/bible-client'
import { setBible } from './math/constants.js'

// THE LIVE-BIBLE BOOTSTRAP.
//
// Steve's rule: "Every time an app is opened it looks at the Bible." So the app
// does not render an analyzer until the live Bible has been fetched and seeded into
// the math layer (constants.js). If the Bible cannot be reached, it shows the
// fail-closed gate instead of an analyzer — it never falls back to a bundled or
// last-known-good copy, because that is a stale number reaching a live deal.
//
// maxAgeMs: 0 = every getBibleDoc() revalidates against the server via ETag
// (304 + empty body when unchanged).

const client = createBibleClient({ maxAgeMs: 0 })
const root = createRoot(document.getElementById('root'))

async function seedAndRender() {
  root.render(<BibleGate loading />)
  try {
    const doc = await client.getBibleDoc()
    setBible(doc.standards)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  } catch (e) {
    root.render(<BibleGate error={e} bibleUrl={client.url} onRetry={seedAndRender} />)
  }
}

// Read the Bible on launch.
seedAndRender()

// Re-read it so a running tab follows a Bible change without a rebuild: on window
// focus and every 5 minutes, revalidate (ETag: 304 + 0 bytes when unchanged) and
// re-seed the math layer. If the Bible becomes unreachable, the next calculation
// throws via loadConstants (fail closed) rather than using a stale number.
if (typeof window !== 'undefined') {
  const revalidate = () => client.getBibleDoc().then((d) => setBible(d.standards)).catch(() => {})
  window.addEventListener('focus', revalidate)
  setInterval(revalidate, 5 * 60 * 1000)
}
