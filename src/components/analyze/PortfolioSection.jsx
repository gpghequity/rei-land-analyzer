import { useState, useMemo } from 'react'
import { PROPERTY_TYPES, deriveNOI, num } from './typeMap.js'
import { buildIncomeMatrix, isIncomeAsset, CAP_MULTIPLIER } from './incomeMatrix.js'

// Portfolio analyzer: N buildings of the SAME income type on one sheet → a
// per-building offer AND a portfolio offer. No new math — each building and the
// aggregate run through the existing Bible income financing matrix.

const money = (n) => (n == null || !Number.isFinite(Number(n))) ? '—' : '$' + Math.round(Number(n)).toLocaleString()
const card = { background: '#fff', border: '1px solid #d4dae8', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }
const h3 = { margin: '0 0 8px', fontSize: 15, color: '#0A0F2C', borderBottom: '2px solid #C9A84C', paddingBottom: 4 }
const inp = { width: '100%', padding: '7px 9px', border: '1px solid #d4dae8', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#1E2A45', margin: '6px 0 2px' }

// Income types only (portfolios are valued off NOI).
const INCOME_TYPES = PROPERTY_TYPES.filter(t => isIncomeAsset(t.id))

const blankBuilding = (n) => ({ label: `Building ${n}`, address: '', askingPrice: '', grossIncome: '', expenses: '' })

export default function PortfolioSection() {
  const [assetType, setAssetType] = useState('self_storage')
  const [buildings, setBuildings] = useState([blankBuilding(1), blankBuilding(2)])

  const setB = (i, k, v) => setBuildings(p => p.map((b, j) => j === i ? { ...b, [k]: v } : b))
  const addB = () => setBuildings(p => [...p, blankBuilding(p.length + 1)])
  const delB = (i) => setBuildings(p => p.length > 1 ? p.filter((_, j) => j !== i) : p)

  const analysis = useMemo(() => {
    const capMult = CAP_MULTIPLIER[assetType] || null
    const rows = buildings.map(b => {
      const noi = deriveNOI(b)
      const m = noi > 0 ? buildIncomeMatrix({ assetType, noi }) : null
      const offer = m ? m.summary.conservativeValue : 0          // 1.25 bank-only
      const capValue = capMult && noi > 0 ? Math.round(noi * capMult) : null
      return { ...b, noi, offer, capValue, asking: num(b.askingPrice) }
    })
    const sumNOI = rows.reduce((a, r) => a + r.noi, 0)
    const sumOffers = rows.reduce((a, r) => a + r.offer, 0)
    const sumAsking = rows.reduce((a, r) => a + r.asking, 0)
    const portfolioM = sumNOI > 0 ? buildIncomeMatrix({ assetType, noi: sumNOI }) : null
    const portfolioOffer = portfolioM ? portfolioM.summary.conservativeValue : 0
    const portfolioRange = portfolioM ? portfolioM.summary.recommendedOfferRange : [0, 0]
    const portfolioCap = capMult && sumNOI > 0 ? Math.round(sumNOI * capMult) : null
    return { rows, sumNOI, sumOffers, sumAsking, portfolioOffer, portfolioRange, portfolioCap, capMult }
  }, [assetType, buildings])

  const typeLabel = INCOME_TYPES.find(t => t.id === assetType)?.label || assetType

  return (
    <div>
      <div style={card} className="no-print">
        <h3 style={h3}>Portfolio — multiple buildings, same type</h3>
        <label style={lbl}>Asset type (all buildings)</label>
        <select aria-label="Portfolio asset type" style={inp} value={assetType} onChange={e => setAssetType(e.target.value)}>
          {INCOME_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>Enter each building’s income &amp; expenses — NOI and offers are computed per building and for the whole portfolio (same Bible income engine).</p>
      </div>

      {buildings.map((b, i) => (
        <div key={i} style={card} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ color: '#0A0F2C' }}>{b.label || `Building ${i + 1}`}</b>
            <button type="button" onClick={() => delB(i)} style={{ border: '1px solid #B23030', color: '#B23030', background: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>Remove</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Label / name</label><input style={inp} value={b.label} onChange={e => setB(i, 'label', e.target.value)} /></div>
            <div><label style={lbl}>Address</label><input style={inp} value={b.address} onChange={e => setB(i, 'address', e.target.value)} /></div>
            <div><label style={lbl}>Asking Price ($)</label><input style={inp} inputMode="decimal" value={b.askingPrice} onChange={e => setB(i, 'askingPrice', e.target.value)} /></div>
            <div><label style={lbl}>Gross Annual Income ($)</label><input style={inp} inputMode="decimal" value={b.grossIncome} onChange={e => setB(i, 'grossIncome', e.target.value)} /></div>
            <div><label style={lbl}>Annual Operating Expenses ($)</label><input style={inp} inputMode="decimal" value={b.expenses} onChange={e => setB(i, 'expenses', e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#1a2456' }}>
            NOI <b>{money(analysis.rows[i]?.noi)}</b> · Offer (1.25 bank) <b>{money(analysis.rows[i]?.offer)}</b>
            {analysis.rows[i]?.capValue != null && <> · Cap-mult <b>{money(analysis.rows[i].capValue)}</b></>}
          </div>
        </div>
      ))}

      <button type="button" onClick={addB} className="no-print" style={{ marginBottom: 12, padding: '8px 16px', borderRadius: 6, border: '1px solid #0A0F2C', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>+ Add building</button>

      {/* Per-building table */}
      <div style={card}>
        <h3 style={h3}>Per-Building Offers — {typeLabel}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
            <thead><tr>{['Building', 'Asking', 'NOI', 'Offer (1.25 bank)', analysis.capMult ? `Cap ×${analysis.capMult}` : null].filter(Boolean).map((hh, i) => (
              <th key={i} style={{ padding: '6px 9px', background: '#0A0F2C', color: '#fff', fontSize: 12, textAlign: i ? 'right' : 'left' }}>{hh}</th>
            ))}</tr></thead>
            <tbody>
              {analysis.rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? '#f7f9fd' : '#fff' }}>
                  <td style={{ padding: '6px 9px', fontWeight: 600 }}>{r.label || `Building ${i + 1}`}</td>
                  <td style={{ padding: '6px 9px', textAlign: 'right' }}>{money(r.asking)}</td>
                  <td style={{ padding: '6px 9px', textAlign: 'right' }}>{money(r.noi)}</td>
                  <td style={{ padding: '6px 9px', textAlign: 'right' }}>{money(r.offer)}</td>
                  {analysis.capMult && <td style={{ padding: '6px 9px', textAlign: 'right' }}>{money(r.capValue)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio summary */}
      <div style={{ ...card, borderLeft: '6px solid #C9A84C' }}>
        <h3 style={h3}>Portfolio Offer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Val label="Total NOI (all buildings)" value={money(analysis.sumNOI)} />
          <Val label="Total Asking" value={money(analysis.sumAsking)} />
          <Val label="Portfolio Offer (NOI pooled, 1.25 bank)" value={money(analysis.portfolioOffer)} />
          <Val label="Sum of per-building offers" value={money(analysis.sumOffers)} />
          <Val label="Recommended portfolio range (1.25→seller-fi)" value={`${money(analysis.portfolioRange[0])} – ${money(analysis.portfolioRange[1])}`} />
          {analysis.portfolioCap != null && <Val label={`Portfolio cap-multiplier (NOI × ${analysis.capMult})`} value={money(analysis.portfolioCap)} />}
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          Portfolio offer pools all NOI and runs the Bible income matrix once (one combined loan). It can differ slightly from the sum of per-building offers due to rounding; either is a valid lens — the pooled number is what a single portfolio loan supports.
        </p>
        <button type="button" className="no-print" onClick={() => window.print()} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, border: '1px solid #0A0F2C', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Print / Save PDF</button>
      </div>
    </div>
  )
}

function Val({ label, value }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: '#1E2A45', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15 }}>{value}</div>
    </div>
  )
}
