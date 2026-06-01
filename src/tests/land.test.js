import { describe, it, expect } from 'vitest'
import { landMetrics, SQFT_PER_ACRE } from '../math/land.js'

describe('Land metrics — deterministic ratios only (no offer math)', () => {
  it('price per acre and per sqft from acres (derives sqft)', () => {
    const m = landMetrics({ askingPrice: 500000, acres: 5 })
    expect(m.pricePerAcre).toBeCloseTo(100000, 0)
    expect(m.lotSqft).toBeCloseTo(5 * SQFT_PER_ACRE, 0)
    expect(m.pricePerSqft).toBeCloseTo(500000 / (5 * SQFT_PER_ACRE), 4)
  })

  it('explicit lotSqft overrides the acres-derived value', () => {
    const m = landMetrics({ askingPrice: 200000, acres: 2, lotSqft: 50000 })
    expect(m.lotSqft).toBe(50000)
    expect(m.pricePerSqft).toBeCloseTo(4, 4)
  })

  it('per-usable-acre, per-buildable-lot, per-approved-unit, per-truck-space, per-storage-acre', () => {
    const m = landMetrics({
      askingPrice: 1000000, acres: 10, usableAcres: 8,
      buildableLots: 4, approvedUnits: 20, truckSpaces: 50, outdoorStorageAcres: 8
    })
    expect(m.pricePerUsableAcre).toBeCloseTo(125000, 0)
    expect(m.pricePerBuildableLot).toBeCloseTo(250000, 0)
    expect(m.pricePerApprovedUnit).toBeCloseTo(50000, 0)
    expect(m.pricePerTruckSpace).toBeCloseTo(20000, 0)
    expect(m.pricePerOutdoorStorageAcre).toBeCloseTo(125000, 0)
  })

  it('income ratios appear ONLY when actual income exists', () => {
    const none = landMetrics({ askingPrice: 500000, acres: 5 })
    expect(none.hasCurrentIncome).toBe(false)
    expect(none.capRateIfIncome).toBeNull()
    expect(none.currentIncomeMultiple).toBeNull()

    const withIncome = landMetrics({ askingPrice: 1000000, acres: 5, currentIncome: 100000, currentNOI: 70000 })
    expect(withIncome.hasCurrentIncome).toBe(true)
    expect(withIncome.currentIncomeMultiple).toBeCloseTo(10, 4)   // 1,000,000 ÷ 100,000
    expect(withIncome.capRateIfIncome).toBeCloseTo(0.07, 4)        // 70,000 ÷ 1,000,000
  })

  it('missing denominators return null (UI shows "—"), never 0 or Infinity', () => {
    const m = landMetrics({ askingPrice: 500000 })
    expect(m.pricePerAcre).toBeNull()
    expect(m.pricePerSqft).toBeNull()
    expect(m.pricePerTruckSpace).toBeNull()
  })

  it('no asking price → all price ratios null', () => {
    const m = landMetrics({ acres: 5, truckSpaces: 10 })
    expect(m.pricePerAcre).toBeNull()
    expect(m.pricePerTruckSpace).toBeNull()
  })
})
