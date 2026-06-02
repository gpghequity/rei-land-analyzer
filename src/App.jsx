import { useState, useEffect } from 'react'
import AnalyzeDealTab from './components/AnalyzeDealTab.jsx'
import QuickAnalysisTab from './components/QuickAnalysisTab.jsx'
import StorageTab from './components/StorageTab.jsx'
import ResidentialTab from './components/ResidentialTab.jsx'
import MhpTab from './components/MhpTab.jsx'
import CommercialTab from './components/CommercialTab.jsx'
import MixedUseTab from './components/MixedUseTab.jsx'
import LandTab from './components/LandTab.jsx'
import QaTab from './components/QaTab.jsx'
import { parseSearchString } from './connectors/urlParams.js'
import { VERSION, BUILD_DATE } from './version.js'

const TABS = [
  { id: 'analyze', label: 'Analyze a Deal', component: AnalyzeDealTab },
  { id: 'quick', label: 'Quick Analysis', component: QuickAnalysisTab },
  { id: 'storage', label: 'Storage', component: StorageTab },
  { id: 'residential', label: 'Residential', component: ResidentialTab },
  { id: 'mhp', label: 'MHP', component: MhpTab },
  { id: 'commercial', label: 'Commercial', component: CommercialTab },
  { id: 'mixeduse', label: 'Mixed Use', component: MixedUseTab },
  { id: 'land', label: 'Land / IOS', component: LandTab },
  { id: 'qa', label: 'QA Runner', component: QaTab }
]

// Read URL params once at module load — populates initial active tab + tab states.
const initialUrlState = typeof window !== 'undefined'
  ? parseSearchString(window.location.search)
  : { tab: null, storage: {}, residential: {} }

export default function App() {
  const [activeTab, setActiveTab] = useState(initialUrlState.tab || 'analyze')

  // Keep document title in sync with the active tab — helps when operator
  // has the page open alongside Fast Calc / Rehab Calc tabs.
  useEffect(() => {
    document.title = `Baby Analyzer — ${TABS.find((t) => t.id === activeTab)?.label || ''}`
  }, [activeTab])

  const ActiveComponent = TABS.find(t => t.id === activeTab).component
  const tabUrlState = activeTab === 'storage' ? initialUrlState.storage
    : activeTab === 'residential' ? initialUrlState.residential
    : null
  // Land tab takes only shared deal info (address / asking) — no tab-specific URL schema.
  // Exit strategies tab takes no url state — it manages its own form state
  const sharedUrlState = {
    address: initialUrlState.address,
    propertyName: initialUrlState.propertyName,
    askingPrice: initialUrlState.askingPrice
  }

  return (
    <div className="page">
      <header className="no-print">
        <h1>REI Baby Analyzer</h1>
        <p className="sub">Operator-grade pre-LOI deal analysis · v{VERSION}</p>
      </header>

      <nav className="no-print">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'tab-btn active' : 'tab-btn'}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <main>
        <ActiveComponent urlState={tabUrlState} sharedUrlState={sharedUrlState} onOpenTab={setActiveTab} />
      </main>

      <footer>
        <div className="footer-copy">© 2026 Projects with a Purpose LLC · Powered by REI Homepage</div>
        <div>REI Baby Analyzer v{VERSION} · Released {BUILD_DATE}</div>
        <div>Math Bible v3.1 (Storage · Residential · MF 1–19 / 20+ tiers · Kicker · Sunset · Ramp) + Fast Calc V2.6 (MHP) + 7 Alt Exit Strategies + Land/IOS intake — drift-tolerant.</div>
        <div className="footer-disclaimer">Estimates only. Operator assumes all underwriting and decision responsibility. Verify numbers independently before any offer or transaction.</div>
      </footer>
    </div>
  )
}
