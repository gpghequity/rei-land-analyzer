import { describe, it, expect } from 'vitest'
import handler from '../../api/calc.js'

// Drive the real /api/calc handler with a tiny mock req/res so we test the
// ACTUAL engine the Analyze-a-Deal tab calls (calc.js is self-contained).
function run(body) {
  let out
  const req = { method: 'POST', body }
  const res = { _s: 200, status(c) { this._s = c; return this }, json(o) { out = o; return this } }
  handler(req, res)
  return out
}

describe('Multifamily tiered engines (Math Bible v3.1 addendum)', () => {
  const NOI = 120000

  it('multifamily_small: 80/20 LTV via residential bank terms; offer = maxPurchase − $10k', () => {
    const r = run({ type: 'multifamily_small', inputs: { noi: NOI } }).result
    expect(r.tier).toBe('1-19 units')
    expect(r.ltv).toBe(0.80)
    // canonical Group-A formula: P_max = NOI / (1.25 × LTV × K)
    const expected = Math.floor(NOI / (1.25 * r.ltv * r.K) / 1000) * 1000
    expect(r.maxPurchase).toBe(expected)
    expect(r.yourOffer).toBe(r.maxPurchase - 10000)
    expect(r.dscrPass).toBe(true) // sized to 1.25 → passes by construction
  })

  it('multifamily_large: identical to Storage Group A (75/25 @ 7.25%/25yr)', () => {
    const large = run({ type: 'multifamily_large', inputs: { noi: NOI } }).result
    const storage = run({ type: 'storage_group_a', inputs: { noi: NOI } }).result
    expect(large.tier).toBe('20+ units')
    expect(large.ltv).toBe(0.75)
    expect(large.maxPurchase).toBe(storage.maxPurchase)
    expect(large.yourOffer).toBe(storage.yourOffer)
  })

  it('1-19 tier supports a HIGHER price than 20+ (cheaper agency debt: lower rate, higher LTV)', () => {
    const small = run({ type: 'multifamily_small', inputs: { noi: NOI } }).result
    const large = run({ type: 'multifamily_large', inputs: { noi: NOI } }).result
    expect(small.maxPurchase).toBeGreaterThan(large.maxPurchase)
  })

  it('zero NOI is handled without throwing', () => {
    const r = run({ type: 'multifamily_small', inputs: { noi: 0 } }).result
    expect(r.maxPurchase).toBe(0)
  })
})
