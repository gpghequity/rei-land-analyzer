import { describe, it, expect } from 'vitest'
import { parseSearchString, buildSearchString } from '../connectors/urlParams.js'

describe('parseSearchString', () => {
  it('returns null tab when not specified', () => {
    const r = parseSearchString('')
    expect(r.tab).toBe(null)
  })

  it('parses a Storage deep link', () => {
    const r = parseSearchString('?tab=storage&address=1234%20Park%20Ln&propname=Hempfield&ask=1500000&gross=180000&sellerpct=0.42&opex=75600')
    expect(r.tab).toBe('storage')
    expect(r.address).toBe('1234 Park Ln')
    expect(r.propertyName).toBe('Hempfield')
    expect(r.askingPrice).toBe(1500000)
    expect(r.storage.grossDollarsIn).toBe(180000)
    expect(r.storage.sellerExpensePct).toBe(0.42)
    expect(r.storage.annualOpEx).toBe(75600)
  })

  it('parses verified flags', () => {
    const r = parseSearchString('?tab=storage&verified=t12,rentroll,occupancy&verifiedby=Steve')
    expect(r.storage.t12Verified).toBe(true)
    expect(r.storage.rentRollVerified).toBe(true)
    expect(r.storage.occupancyVerified).toBe(true)
    expect(r.storage.verifiedBy).toBe('Steve')
  })

  it('parses partial verified flags', () => {
    const r = parseSearchString('?verified=t12,rentroll')
    expect(r.storage.t12Verified).toBe(true)
    expect(r.storage.rentRollVerified).toBe(true)
    expect(r.storage.occupancyVerified).toBe(false)
  })

  it('parses a Residential Flip deep link', () => {
    const r = parseSearchString('?tab=residential&mode=flip&arv=210000&rehab=35000&comps=200000,220000,240000,260000,280000')
    expect(r.tab).toBe('residential')
    expect(r.residential.mode).toBe('flip')
    expect(r.residential.arv).toBe(210000)
    expect(r.residential.rehab).toBe(35000)
    expect(r.residential.compsRaw).toBe('200000\n220000\n240000\n260000\n280000')
  })

  it('parses a Residential Rental deep link', () => {
    const r = parseSearchString('?tab=residential&mode=rental&income=42000&expenses=14000&rehab=8000')
    expect(r.residential.mode).toBe('rental')
    expect(r.residential.grossDollarsIn).toBe(42000)
    expect(r.residential.hardCosts).toBe(14000)
    expect(r.residential.rehab).toBe(8000)
  })

  it('rejects unknown tab values', () => {
    expect(parseSearchString('?tab=garbage').tab).toBe(null)
  })

  it('rejects unknown residential mode values', () => {
    expect(parseSearchString('?tab=residential&mode=garbage').residential.mode).toBe(null)
  })

  it('null on empty number params', () => {
    const r = parseSearchString('?tab=storage&gross=&sellerpct=')
    expect(r.storage.grossDollarsIn).toBe(null)
    expect(r.storage.sellerExpensePct).toBe(null)
  })

  it('null on non-numeric number params', () => {
    const r = parseSearchString('?tab=storage&gross=abc')
    expect(r.storage.grossDollarsIn).toBe(null)
  })
})

describe('buildSearchString', () => {
  it('round-trips a Storage state', () => {
    const original = '?tab=storage&address=1+A+St&ask=1000000&gross=100000&sellerpct=0.4&verified=t12,rentroll,occupancy&verifiedby=Steve'
    const parsed = parseSearchString(original)
    const built = buildSearchString({
      tab: 'storage',
      address: parsed.address,
      askingPrice: parsed.askingPrice,
      storage: parsed.storage
    })
    const reparsed = parseSearchString('?' + built)
    expect(reparsed.tab).toBe('storage')
    expect(reparsed.address).toBe('1 A St')
    expect(reparsed.askingPrice).toBe(1000000)
    expect(reparsed.storage.grossDollarsIn).toBe(100000)
    expect(reparsed.storage.sellerExpensePct).toBe(0.4)
    expect(reparsed.storage.t12Verified).toBe(true)
    expect(reparsed.storage.verifiedBy).toBe('Steve')
  })

  it('round-trips Residential Flip with comps', () => {
    const built = buildSearchString({
      tab: 'residential',
      residential: {
        mode: 'flip',
        arv: 210000,
        rehab: 35000,
        compsRaw: '200000\n220000\n240000'
      }
    })
    const r = parseSearchString('?' + built)
    expect(r.residential.mode).toBe('flip')
    expect(r.residential.arv).toBe(210000)
    expect(r.residential.compsRaw).toBe('200000\n220000\n240000')
  })

  it('omits empty fields', () => {
    const built = buildSearchString({ tab: 'storage', storage: {} })
    expect(built).toBe('tab=storage')
  })
})
