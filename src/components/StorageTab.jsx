import { useState } from 'react'
import { storageNOI, groupA_maxPurchase, groupA_equityRequirement, groupB_maxPurchase, groupC_maxPurchase, pocketCash } from '../math/storage.js'
import { sunsetTest } from '../math/sunsetTest.js'
import { rampTest } from '../math/rampTest.js'
import { kickerProjection } from '../math/kicker.js'
import { computeStorageVerdict } from '../math/verdict.js'
import { runStorageDeal } from '../math/scenarioEngine.js'
import { loadConstants } from '../math/constants.js'

const C = loadConstants()

// Defaults pulled from defaults.json so the form starts empty/usable.
const INITIAL = {
  propertyName: '',
  address: '',
  askingPrice: '',
  grossDollarsIn: '',
  sellerExpensePct: '',
  annualOpEx: '',
  // Verification flags — required for verdict gate to clear
  t12Verified: false,
  rentRollVerified: false,
  occupancyVerified: false,
  verifiedBy: '',
  // Kicker assumptions
  growthRate: 0.03
}

// Hydrate INITIAL with values pulled from URL params (if any) so the operator
// can deep-link from Fast Calc with everything pre-filled.
function buildInitial(urlState, sharedUrlState) {
  const u = urlState || {}
  const s = sharedUrlState || {}
  return {
    ...INITIAL,
    propertyName: s.propertyName ?? INITIAL.propertyName,
    address: s.address ?? INITIAL.address,
    askingPrice: s.askingPrice != null ? String(s.askingPrice) : INITIAL.askingPrice,
    grossDollarsIn: u.grossDollarsIn != null ? String(u.grossDollarsIn) : INITIAL.grossDollarsIn,
    sellerExpensePct: u.sellerExpensePct != null ? String(u.sellerExpensePct) : INITIAL.sellerExpensePct,
    annualOpEx: u.annualOpEx != null ? String(u.annualOpEx) : INITIAL.annualOpEx,
    t12Verified: u.t12Verified ?? INITIAL.t12Verified,
    rentRollVerified: u.rentRollVerified ?? INITIAL.rentRollVerified,
    occupancyVerified: u.occupancyVerified ?? INITIAL.occupancyVerified,
    verifiedBy: u.verifiedBy ?? INITIAL.verifiedBy,
    growthRate: u.growthRate != null ? u.growthRate : INITIAL.growthRate
  }
}

export default function StorageTab({ urlState, sharedUrlState }) {
  const [inputs, setInputs] = useState(() => buildInitial(urlState, sharedUrlState))
  const [results, setResults] = useState(null)

  const update = (field, value) => setInputs(prev => ({ ...prev, [field]: value }))

  const calc = () => {
    const g = parseFloat(inputs.grossDollarsIn) || 0
    const e = parseFloat(inputs.sellerExpensePct) || 0
    const op = parseFloat(inputs.annualOpEx) || 0
    if (g <= 0) {
      setResults({ error: 'Gross dollars in must be greater than 0.' })
      return
    }

    const dealOutput = runStorageDeal({
      grossDollarsIn: g,
      sellerStatedExpensePct: e,
      annualOpEx: op,
      kickerOptions: {
        growthRate: parseFloat(inputs.growthRate) || 0.03,
        pct: C.PCT_DEFAULT,
        cap: C.CAP_DEFAULT,
        windowYears: C.WINDOW_YEARS
      }
    })

    const verdict = computeStorageVerdict(dealOutput, {
      t12Verified: inputs.t12Verified,
      rentRollVerified: inputs.rentRollVerified,
      occupancyVerified: inputs.occupancyVerified,
      verifiedBy: inputs.verifiedBy
    })

    setResults({ ...dealOutput, verdict })
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Storage</h2>
        <p style={{ color: '#5a6a8a', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Math Bible v3 storage engine — Group A/B/C max purchase, pocket cash, equity required,
          ramp test (1.15x lens), sunset test (Group B/C balloon), kicker projection.
        </p>
      </header>

      <FormGroup label="Property name (optional)">
        <Input value={inputs.propertyName} onChange={v => update('propertyName', v)} placeholder="e.g. Hempfield Storage" />
      </FormGroup>

      <FormGroup label="Address (optional)">
        <Input value={inputs.address} onChange={v => update('address', v)} placeholder="123 Main St, Lancaster PA" />
      </FormGroup>

      <FormGroup label="Asking price ($, optional)" hint="For implied cap rate display only.">
        <Input type="number" value={inputs.askingPrice} onChange={v => update('askingPrice', v)} placeholder="1500000" />
      </FormGroup>

      <FormGroup label="Gross dollars in (T-12 collected, $) *" hint="Required. Verified T-12 EGI — what the property actually collected, not seller's pro-forma.">
        <Input type="number" value={inputs.grossDollarsIn} onChange={v => update('grossDollarsIn', v)} placeholder="180000" />
      </FormGroup>

      <FormGroup label="Seller-stated expense ratio (decimal)" hint={`35% floor (${formatPct(C.STORAGE_EXPENSE_FLOOR)}) auto-applied — whichever is higher.`}>
        <Input type="number" step="0.01" value={inputs.sellerExpensePct} onChange={v => update('sellerExpensePct', v)} placeholder="0.42" />
      </FormGroup>

      <FormGroup label="Annual operating expenses ($, optional)" hint="Used for the working-capital reserve in equity required (25% of annual OpEx).">
        <Input type="number" value={inputs.annualOpEx} onChange={v => update('annualOpEx', v)} placeholder="75600" />
      </FormGroup>

      <FormGroup label="NOI growth rate for kicker projection" hint="Default 3% conservative. Used to project years 1-5 of seller-fi kicker.">
        <Input type="number" step="0.005" value={inputs.growthRate} onChange={v => update('growthRate', v)} placeholder="0.03" />
      </FormGroup>

      <fieldset style={{ border: '1px solid #d4dae8', borderRadius: 6, padding: 16, margin: 0 }}>
        <legend style={{ padding: '0 8px', color: '#1a2456', fontSize: 13, fontWeight: 600 }}>
          Data Quality Gate (Brief 3b E2 — required for non-TENANTIVE verdict)
        </legend>
        <Checkbox label="T-12 verified by Steve / team / qualified third party" checked={inputs.t12Verified} onChange={v => update('t12Verified', v)} />
        <Checkbox label="Rent roll verified" checked={inputs.rentRollVerified} onChange={v => update('rentRollVerified', v)} />
        <Checkbox label="Occupancy verified" checked={inputs.occupancyVerified} onChange={v => update('occupancyVerified', v)} />
        <FormGroup label="Verified by" hint="Must be one of: Steve / team / qualified third party.">
          <select value={inputs.verifiedBy} onChange={e => update('verifiedBy', e.target.value)} style={selectStyle}>
            <option value="">— not verified —</option>
            <option value="Steve">Steve</option>
            <option value="team">team</option>
            <option value="qualified third party">qualified third party</option>
          </select>
        </FormGroup>
      </fieldset>

      <button type="button" onClick={calc} style={btnStyle}>Calculate</button>

      {results && results.error && (
        <div style={errorBoxStyle}>{results.error}</div>
      )}

      {results && !results.error && (
        <div className="results-section">
          <StorageResults results={results} askingPrice={parseFloat(inputs.askingPrice) || 0} />
          <LoiPrepStorage inputs={inputs} results={results} />
        </div>
      )}
    </section>
  )
}

function LoiPrepStorage({ inputs, results }) {
  const groupA125 = results.scenarios.find(s => s.group === 'A' && s.dscrLens === 1.25 && s.treatment === 'sunk')
  const noi = results.noiResult.noi
  const ask = parseFloat(inputs.askingPrice) || 0
  const verdict = results.verdict
  const printNow = () => { window.print() }

  return (
    <div className="loi-prep-section">
      <h3>LOI Prep — Storage</h3>
      <div className="loi-prep-grid">
        {inputs.propertyName && <div className="loi-prep-row"><span className="lp-k">Property</span><span className="lp-v">{inputs.propertyName}</span></div>}
        {inputs.address && <div className="loi-prep-row"><span className="lp-k">Address</span><span className="lp-v">{inputs.address}</span></div>}
        <div className="loi-prep-row"><span className="lp-k">Asset type</span><span className="lp-v">Storage</span></div>
        {ask > 0 && <div className="loi-prep-row"><span className="lp-k">Asking price</span><span className="lp-v">{formatMoney(ask)}</span></div>}
        <div className="loi-prep-row"><span className="lp-k">Verified NOI (T-12)</span><span className="lp-v">{formatMoney(noi)}</span></div>
        {ask > 0 && <div className="loi-prep-row"><span className="lp-k">Implied cap on ask</span><span className="lp-v">{formatPct(noi / ask)}</span></div>}
        {groupA125 && (
          <>
            <div className="loi-prep-row"><span className="lp-k">Recommended max purchase (Bank, 1.25x DSCR)</span><span className="lp-v">{formatMoney(groupA125.maxPurchase)}</span></div>
            <div className="loi-prep-row"><span className="lp-k">Recommended offer (− wholesale fee)</span><span className="lp-v">{formatMoney(groupA125.yourOffer)}</span></div>
            <div className="loi-prep-row"><span className="lp-k">Annual debt service (bank)</span><span className="lp-v">{formatMoney(groupA125.bankAnnualDS)}</span></div>
            <div className="loi-prep-row"><span className="lp-k">Annual pocket cash (post-DS)</span><span className="lp-v">{formatMoney(groupA125.pocket.pocketCash)}</span></div>
            {groupA125.equityReq && <div className="loi-prep-row"><span className="lp-k">Total equity required</span><span className="lp-v">{formatMoney(groupA125.equityReq.totalEquityRequired)}</span></div>}
          </>
        )}
        <div className="loi-prep-row"><span className="lp-k">Verdict</span><span className="lp-v">{verdict.verdict}</span></div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #d4dae8', fontSize: 12, color: '#5a6a8a', fontStyle: 'italic' }}>
        This is a pre-LOI internal worksheet. Math Bible v3 tougher-of-the-engines numbers shown above. Verify all
        figures against the source T-12 / appraisal / lender quote before issuing an actual LOI.
      </div>

      <div className="no-print" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="button" onClick={printNow} style={btnStyle}>Print LOI Prep</button>
        <button type="button" onClick={() => navigator.clipboard?.writeText(buildPlainText(inputs, results, groupA125))} style={btnGhostStyle}>Copy as text</button>
      </div>
    </div>
  )
}

function buildPlainText(inputs, results, groupA125) {
  const lines = []
  const noi = results.noiResult.noi
  const ask = parseFloat(inputs.askingPrice) || 0
  lines.push('LOI Prep — Storage')
  lines.push('')
  if (inputs.propertyName) lines.push(`Property: ${inputs.propertyName}`)
  if (inputs.address) lines.push(`Address: ${inputs.address}`)
  lines.push('Asset type: Storage')
  if (ask) lines.push(`Asking: ${formatMoney(ask)}`)
  lines.push(`Verified NOI: ${formatMoney(noi)}`)
  if (ask) lines.push(`Implied cap on ask: ${formatPct(noi / ask)}`)
  if (groupA125) {
    lines.push(`Max purchase (Bank, 1.25x DSCR): ${formatMoney(groupA125.maxPurchase)}`)
    lines.push(`Recommended offer: ${formatMoney(groupA125.yourOffer)}`)
    lines.push(`Annual DS: ${formatMoney(groupA125.bankAnnualDS)}`)
    lines.push(`Annual pocket cash: ${formatMoney(groupA125.pocket.pocketCash)}`)
    if (groupA125.equityReq) lines.push(`Total equity required: ${formatMoney(groupA125.equityReq.totalEquityRequired)}`)
  }
  lines.push(`Verdict: ${results.verdict.verdict}`)
  lines.push('')
  lines.push('Pre-LOI internal worksheet — Math Bible v3.')
  lines.push('Verify all figures against source T-12 / appraisal / lender quote.')
  return lines.join('\n')
}

const btnGhostStyle = {
  padding: '12px 24px', fontSize: 14, fontWeight: 600,
  color: '#1a2456', backgroundColor: 'transparent',
  border: '1px solid #c8d0e0', borderRadius: 6, cursor: 'pointer'
}

function StorageResults({ results, askingPrice }) {
  const { noiResult, scenarios, kickerProj, verdict } = results
  const noi = noiResult.noi

  const groupA125 = scenarios.find(s => s.group === 'A' && s.dscrLens === 1.25 && s.treatment === 'sunk')
  const groupA115 = scenarios.find(s => s.group === 'A' && s.dscrLens === 1.15 && s.treatment === 'sunk')
  const groupB125 = scenarios.find(s => s.group === 'B' && s.dscrLens === 1.25 && s.treatment === 'sunk')
  const groupB115 = scenarios.find(s => s.group === 'B' && s.dscrLens === 1.15 && s.treatment === 'sunk')
  const groupC125 = scenarios.find(s => s.group === 'C' && s.dscrLens === 1.25)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16, borderTop: '2px solid #1a2456' }}>
      <Verdict verdict={verdict} />

      <Card title="NOI">
        <Row label="Gross collected" value={formatMoney(noiResult.grossDollarsIn)} />
        <Row label="Effective expense %" value={formatPct(noiResult.expenseRatio)} accent={noiResult.floorBinds ? '35% floor binds' : 'seller wins'} />
        <Row label="Expenses" value={formatMoney(noiResult.expenses)} />
        <Row label="NOI" value={formatMoney(noiResult.noi)} bold />
        {askingPrice > 0 && <Row label="Implied cap on ask" value={formatPct(noi / askingPrice)} accent={`vs ask ${formatMoney(askingPrice)}`} />}
      </Card>

      <Card title="Group A — Bank only @ 1.25x conservative">
        <ScenarioBlock s={groupA125} variant="A" noi={noi} />
      </Card>

      <Card title="Group A — Bank only @ 1.15x stretch + Ramp Test">
        <ScenarioBlock s={groupA115} variant="A" noi={noi} ramp />
      </Card>

      <Card title="Group B — Seller-fi only @ 1.25x conservative + Sunset Test">
        <ScenarioBlock s={groupB125} variant="B" noi={noi} sunset />
      </Card>

      <Card title="Group B — Seller-fi only @ 1.15x stretch + Sunset Test + Ramp Test">
        <ScenarioBlock s={groupB115} variant="B" noi={noi} ramp sunset />
      </Card>

      <Card title="Group C — Bank + seller-note on equity @ 1.25x">
        <ScenarioBlock s={groupC125} variant="C" noi={noi} sunset />
      </Card>

      {kickerProj && kickerProj.length > 0 && (
        <Card title={`Kicker projection (${formatPct(C.PCT_DEFAULT)} of NOI growth, $${(C.CAP_DEFAULT/1000).toFixed(0)}k cap, ${C.WINDOW_YEARS} years)`}>
          {kickerProj.map(y => (
            <Row
              key={y.year}
              label={`Year ${y.year}`}
              value={`Projected NOI ${formatMoney(y.projectedNOI)}`}
              accent={`Kicker ${formatMoney(y.kickerPayment)} · cumulative ${formatMoney(y.cumulative)}`}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function Verdict({ verdict }) {
  const colors = {
    PASS:      { bg: '#e8f5ee', fg: '#0d5e2c', border: '#5fb785' },
    PURSUE:    { bg: '#fff8dc', fg: '#7a5b00', border: '#d4af37' },
    NEGOTIATE: { bg: '#fff3e0', fg: '#a05a00', border: '#e6a45c' },
    TENANTIVE: { bg: '#f0f0f0', fg: '#505050', border: '#a0a0a0' },
    KILL:      { bg: '#fde2e2', fg: '#7a0000', border: '#d04040' }
  }
  const c = colors[verdict.verdict] || colors.TENANTIVE
  return (
    <div style={{
      backgroundColor: c.bg, color: c.fg, border: `2px solid ${c.border}`,
      borderRadius: 6, padding: 16
    }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 }}>Verdict</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{verdict.verdict}</div>
      <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.5 }}>
        {verdict.reasonCodes.map(r => <li key={r}>{r.replace(/_/g, ' ').toLowerCase()}</li>)}
      </ul>
      {verdict.blockingFlags.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic' }}>
          Blocking: {verdict.blockingFlags.join(', ')}
        </div>
      )}
    </div>
  )
}

function ScenarioBlock({ s, variant, noi, ramp, sunset }) {
  if (!s) return <div style={{ color: '#a0a0a0', fontSize: 13 }}>—</div>
  const equityReq = variant === 'A' ? s.equityReq : null
  return (
    <>
      <Row label="Max purchase" value={formatMoney(s.maxPurchase)} bold />
      <Row label="Your offer (− wholesale fee)" value={formatMoney(s.yourOffer)} bold />
      {variant === 'A' && <Row label="Bank annual DS" value={formatMoney(s.bankAnnualDS)} />}
      {variant === 'B' && <Row label="Seller annual DS" value={formatMoney(s.sellerAnnualDS)} />}
      {variant === 'C' && (
        <>
          <Row label="Bank annual DS" value={formatMoney(s.bankAnnualDS)} />
          <Row label="Seller annual P&I (on equity)" value={formatMoney(s.sellerAnnualPI)} />
        </>
      )}
      <Row label="Equity amount" value={formatMoney(s.equityAmount)} />
      <Row
        label="Pocket cash (post-DS)"
        value={formatMoney(s.pocket.pocketCash)}
        accent={s.pocket.clearsFloor ? `clears $${(C.POCKET_FLOOR/1000).toFixed(0)}k floor` : `BELOW $${(C.POCKET_FLOOR/1000).toFixed(0)}k floor`}
        accentColor={s.pocket.clearsFloor ? '#0d5e2c' : '#7a0000'}
      />

      {variant === 'A' && equityReq && (
        <>
          <Row label="Cash to close" value={formatMoney(equityReq.cashToClose)} accent="includes points/fees/legal/title/PITI reserve" />
          <Row label="Working capital (25% of OpEx)" value={formatMoney(equityReq.workingCapital)} />
          <Row label="Total equity required" value={formatMoney(equityReq.totalEquityRequired)} bold />
        </>
      )}

      {ramp && s.rampResult && (
        <Row
          label="Ramp test (Y1 ≥ 1.15 · Y2 ≥ 1.25)"
          value={s.rampResult.flag}
          accent={`Y1 ${s.rampResult.dscrY1.toFixed(2)} · Y2 ${s.rampResult.dscrY2.toFixed(2)}`}
          accentColor={s.rampResult.pass ? '#0d5e2c' : '#7a0000'}
        />
      )}

      {sunset && s.sunsetResult && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d4dae8' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5a6a8a', marginBottom: 4 }}>Sunset Test (refi gap @ Y3/5/7/10)</div>
          {s.sunsetResult.map(c => (
            <Row
              key={c.yearN}
              label={`Y${c.yearN}`}
              value={c.flag}
              accent={`NOI ${formatMoney(c.noiN)} · post-refi DSCR ${c.postSunsetDSCR.toFixed(2)} · gap ${formatMoney(c.refiGap)}`}
              accentColor={c.flag === 'DURABLE' ? '#0d5e2c' : c.flag === 'FRAGILE' ? '#7a5b00' : '#7a0000'}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ---------- shared little components ----------

function FormGroup({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2456' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: '#8a96b0', fontStyle: 'italic' }}>{hint}</span>}
    </label>
  )
}

function Input({ type = 'text', value, onChange, placeholder, step }) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  )
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ border: '1px solid #d4dae8', borderRadius: 6, backgroundColor: '#fff', padding: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#1a2456' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Row({ label, value, bold, accent, accentColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14, paddingBottom: 4, borderBottom: '1px dashed #eef2fb' }}>
      <span style={{ color: '#5a6a8a' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: bold ? 700 : 500, color: '#1a2456' }}>{value}</span>
        {accent && <div style={{ fontSize: 11, color: accentColor || '#8a96b0', marginTop: 2 }}>{accent}</div>}
      </span>
    </div>
  )
}

// ---------- styles ----------

const inputStyle = {
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #c8d0e0',
  borderRadius: 4,
  fontFamily: 'inherit',
  color: '#1a2456',
  backgroundColor: '#fff'
}

const selectStyle = { ...inputStyle, paddingRight: 28 }

const btnStyle = {
  padding: '12px 24px',
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  backgroundColor: '#1a2456',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  alignSelf: 'flex-start'
}

const errorBoxStyle = {
  padding: 12,
  border: '1px solid #d04040',
  borderRadius: 6,
  backgroundColor: '#fde2e2',
  color: '#7a0000',
  fontSize: 13
}

// ---------- formatters ----------

function formatMoney(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function formatPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}
