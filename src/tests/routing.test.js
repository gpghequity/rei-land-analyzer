// routing.test.js — HARD VALIDATION of Math Bible engine routing per asset class.
//
// Core rule: every property type uses the CORRECT Math Bible engine for that type.
// Math is NOT standardized across asset classes — only the report layout is.
// This file is the gate that must pass before deploy.

import { describe, it, expect } from 'vitest'
import { PROPERTY_TYPES, getType } from '../components/analyze/typeMap.js'
import { isIncomeAsset, INCOME_ASSET_TYPES, bankTermsFor } from '../components/analyze/incomeMatrix.js'
import { loadConstants } from '../math/constants.js'
import calcHandler from '../../api/calc.js'

const C = loadConstants()

function calc(body) {
  let out
  calcHandler({ method: 'POST', body }, { _s: 200, status(c) { this._s = c; return this }, json(o) { out = o; return this } })
  return out
}

describe('Math Bible engine routing — per asset class', () => {
  // 1 + 1–4 residential
  it('Residential routes to RESIDENTIAL math (MAO for flip, DSCR for rental) — never storage', () => {
    const r = getType('residential')
    expect(isIncomeAsset('residential')).toBe(false)
    expect(r.buildCalc({ arv: 300000, rehab: 50000 }, 'flip').type).toBe('residential_mao')
    expect(r.buildCalc({ noi: 24000, purchase: 200000 }, 'rental').type).toBe('residential_dscr')
  })

  // 2. Multifamily 1–19 → residential / agency-style
  it('Multifamily 1–19 routes to AGENCY/residential-style math (80/20 @ 7%/30yr), NOT storage', () => {
    expect(isIncomeAsset('multifamily_small')).toBe(false) // not the storage matrix
    const c = getType('multifamily_small').buildCalc({ noi: 120000 })
    expect(c.type).toBe('multifamily_small')
    const r = calc({ type: 'multifamily_small', inputs: { noi: 120000 } }).result
    expect(r.ltv).toBe(0.80)                 // 80/20
    expect(r.K).toBeCloseTo(C.K_BANK_RESI, 6) // 7% / 30-yr agency
  })

  // 3. Multifamily 20+ → storage / commercial income-property framework
  it('Multifamily 20+ routes to STORAGE/commercial income framework (75/25 @ 7.25%/25yr)', () => {
    expect(isIncomeAsset('multifamily_large')).toBe(true) // uses the income scenario matrix
    const t = bankTermsFor('multifamily_large', C)
    expect(t.ltv).toBe(0.75)
    expect(t.K).toBeCloseTo(C.K_BANK_STORAGE, 6)
    // single-offer fallback equals Storage Group A by construction
    const large = calc({ type: 'multifamily_large', inputs: { noi: 120000 } }).result
    const storage = calc({ type: 'storage_group_a', inputs: { noi: 120000 } }).result
    expect(large.maxPurchase).toBe(storage.maxPurchase)
  })

  // 4. Self Storage → storage math
  it('Self Storage routes to STORAGE math (75/25 @ 7.25%/25yr)', () => {
    expect(isIncomeAsset('self_storage')).toBe(true)
    const t = bankTermsFor('self_storage', C)
    expect(t.ltv).toBe(0.75)
    expect(t.K).toBeCloseTo(C.K_BANK_STORAGE, 6)
    expect(getType('self_storage').buildCalc({ noi: 90000 }).type).toBe('storage_group_a')
  })

  // 5. Commercial → storage/commercial income math (its own engine), NOT residential
  it('Commercial routes to COMMERCIAL income-property math (75/25 @ 7%/30yr), never residential', () => {
    expect(isIncomeAsset('commercial')).toBe(true)
    const t = bankTermsFor('commercial', C)
    expect(t.ltv).toBe(0.75)                        // 75/25, not 70/30
    expect(getType('commercial').buildCalc({ noi: 200000 }).type).toBe('commercial_dscr')
  })

  // 6. MHP / RV → storage/commercial income math (full engine on the MHP tab)
  it('MHP/RV routes to storage/commercial income framework (75/25)', () => {
    expect(isIncomeAsset('mhp_rv')).toBe(true)
    expect(bankTermsFor('mhp_rv', C).ltv).toBe(0.75)
  })

  // 7. Mixed Use → mixed-use / income framework
  it('Mixed Use routes to the income framework (commercial terms; full split on Mixed Use tab)', () => {
    expect(isIncomeAsset('mixed_use')).toBe(true)
    expect(bankTermsFor('mixed_use', C).ltv).toBe(0.75)
  })

  // 8. Land / IOS → supported-intake ONLY, never any income/offer engine
  it('Land/IOS routes to LAND supported-intake only — never storage/residential/MF/commercial math', () => {
    const land = getType('ios_land')
    expect(land.implemented).toBe(false)
    expect(isIncomeAsset('ios_land')).toBe(false)
    expect(land.buildCalc({ noi: 0 })).toBeNull()
    expect(land.buildCalc({ noi: 50000 })).toBeNull() // income present → STILL no storage math
  })
})

describe('Hard LTV / no-cross-borrow guarantees', () => {
  it('Storage uses 75/25 (NOT 70/30)', () => {
    expect(C.LTV_STORAGE).toBe(0.75)
    expect(bankTermsFor('self_storage', C).ltv).toBe(0.75)
  })
  it('Residential uses 80/20', () => {
    expect(C.LTV_RESI).toBe(0.80)
    expect(calc({ type: 'residential_dscr', inputs: { annualNOI: 24000, purchase: 200000 } }).result.loan)
      .toBeCloseTo(200000 * 0.80, 0)
  })
  it('Multifamily 1–19 uses 80/20; Multifamily 20+ uses 75/25', () => {
    expect(calc({ type: 'multifamily_small', inputs: { noi: 120000 } }).result.ltv).toBe(0.80)
    expect(calc({ type: 'multifamily_large', inputs: { noi: 120000 } }).result.ltv).toBe(0.75)
  })
  it('No income asset borrows residential 80/20 — every income-matrix asset is 75/25', () => {
    for (const t of INCOME_ASSET_TYPES) {
      expect(bankTermsFor(t, C).ltv).toBe(0.75)
    }
  })
  it('Land calculates NO offer (no maxPurchase / yourOffer field path)', () => {
    // The land math module exposes only ratio metrics — assert there is no offer key.
    const land = getType('ios_land')
    expect(land.buildCalc({ askingPrice: 500000, acres: 5, noi: 80000 })).toBeNull()
  })
})
