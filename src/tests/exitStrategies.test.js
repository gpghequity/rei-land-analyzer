// Contract tests for exitStrategies.js
// Tests verify key outputs for known inputs — catch regressions, not implementation details.

import { describe, it, expect } from 'vitest'
import {
  calcSTR, calcMTR, calcBRRRR, calcCoLiving,
  calcHouseHack, calcLeaseOption, calcCreative
} from '../math/exitStrategies.js'

describe('calcSTR', () => {
  it('computes gross revenue and NOI correctly', () => {
    const r = calcSTR({ nightlyRate: 185, occupancyPct: 0.65, annualOpex: 12000, allInPrice: 200000 })
    expect(r.strategy).toBe('STR')
    expect(r.occupiedNights).toBe(Math.round(365 * 0.65))
    expect(r.grossRevenue).toBeCloseTo(185 * 365 * 0.65, 0)
    expect(r.ok).toBe(true)
  })

  it('returns negative NOI when opex exceeds revenue', () => {
    const r = calcSTR({ nightlyRate: 50, occupancyPct: 0.30, annualOpex: 30000 })
    expect(r.noi).toBeLessThan(0)
    expect(r.ok).toBe(false)
  })

  it('computes cap rate when allInPrice provided', () => {
    const r = calcSTR({ nightlyRate: 200, occupancyPct: 0.70, annualOpex: 10000, allInPrice: 250000 })
    expect(r.capRate).not.toBeNull()
    expect(r.capRate).toBeGreaterThan(0)
    expect(r.grm).toBeGreaterThan(0)
  })

  it('returns null cap rate when allInPrice is 0', () => {
    const r = calcSTR({ nightlyRate: 150, occupancyPct: 0.65, annualOpex: 8000 })
    expect(r.capRate).toBeNull()
  })
})

describe('calcMTR', () => {
  it('computes premium over LTR correctly', () => {
    const r = calcMTR({ monthlyRate: 2800, occupancyPct: 0.90, ltrComparison: 1400, annualOpex: 10000, allInPrice: 175000 })
    expect(r.strategy).toBe('MTR')
    expect(r.premiumVsLtr).toBeCloseTo(1400, 0)
    expect(r.premiumPct).toBeCloseTo(1.0, 1)  // 100% premium
    expect(r.ok).toBe(true)
  })

  it('computes furnishing payback', () => {
    const r = calcMTR({ monthlyRate: 2800, occupancyPct: 0.90, ltrComparison: 1400, furnishingCost: 8000, annualOpex: 10000 })
    expect(r.furnishingPayback).toBeCloseTo(8000 / (1400 * 12), 1)
  })

  it('returns null premium when no ltr comparison', () => {
    const r = calcMTR({ monthlyRate: 2800, occupancyPct: 0.90, annualOpex: 10000 })
    expect(r.premiumVsLtr).toBeNull()
  })
})

describe('calcBRRRR', () => {
  it('computes all-in cost and cash left in correctly', () => {
    const r = calcBRRRR({
      purchasePrice: 95000, rehabCost: 45000, closingCostsBuy: 2850,
      monthlyRent: 1650, arv: 190000, ltvPct: 0.75
    })
    expect(r.strategy).toBe('BRRRR')
    expect(r.allIn).toBeCloseTo(95000 + 45000 + 2850, 0)
    expect(r.refiLoan).toBeCloseTo(190000 * 0.75, 0)
    expect(r.equityCreated).toBeCloseTo(190000 - r.allIn, 0)
    expect(r.ok).toBe(true)
  })

  it('detects when BRRRR works (cash left in ≤ 0)', () => {
    // Low all-in relative to ARV should produce a successful BRRRR
    const r = calcBRRRR({
      purchasePrice: 60000, rehabCost: 30000, closingCostsBuy: 1800,
      monthlyRent: 1500, arv: 160000, ltvPct: 0.75
    })
    // refiLoan = 120000, allIn = 91800 → cashLeftIn = 91800 - 120000 < 0
    expect(r.brrrrWorks).toBe(true)
    expect(r.cashLeftIn).toBeLessThan(0)
  })

  it('computes DSCR post-refi', () => {
    const r = calcBRRRR({
      purchasePrice: 95000, rehabCost: 45000, monthlyRent: 1650,
      arv: 190000, ltvPct: 0.75, refiRate: 0.075
    })
    expect(r.dscr).toBeGreaterThan(0)
  })

  it('uses 3% default closing costs when not specified', () => {
    const r = calcBRRRR({ purchasePrice: 100000, rehabCost: 30000, monthlyRent: 1500, arv: 165000 })
    expect(r.closing).toBeCloseTo(3000, 0)
    expect(r.allIn).toBeCloseTo(133000, 0)
  })
})

describe('calcCoLiving', () => {
  it('computes gross revenue correctly', () => {
    const r = calcCoLiving({ bedrooms: 4, perRoomRent: 750, occupancyPct: 0.92, annualOpex: 11000, allInPrice: 180000 })
    expect(r.strategy).toBe('CoLiving')
    expect(r.grossAnnual).toBeCloseTo(4 * 750 * 12 * 0.92, 0)
    expect(r.ok).toBe(true)
  })

  it('computes premium vs whole-house LTR', () => {
    const r = calcCoLiving({ bedrooms: 4, perRoomRent: 750, occupancyPct: 0.92, wholeHouseLtr: 1600, annualOpex: 11000 })
    const roomGross = 4 * 750 * 12 * 0.92
    const ltrAnn = 1600 * 12
    expect(r.vsLtrAnnual).toBeCloseTo(roomGross - ltrAnn, 0)
  })
})

describe('calcHouseHack', () => {
  it('computes effective monthly cost correctly', () => {
    const r = calcHouseHack({ purchasePrice: 240000, units: 3, unitRents: [1100, 1050], monthlyPiti: 1650, marketRentOwner: 1300 })
    expect(r.strategy).toBe('HouseHack')
    expect(r.rentalIncomeMo).toBe(2150)
    expect(r.effectiveMonthlyCost).toBeCloseTo(1650 - 2150, 0)
    expect(r.freeLiving).toBe(true)
  })

  it('detects free living when tenants cover PITI', () => {
    const r = calcHouseHack({ purchasePrice: 200000, units: 2, unitRents: [1800], monthlyPiti: 1500 })
    expect(r.freeLiving).toBe(true)
    expect(r.effectiveMonthlyCost).toBeLessThanOrEqual(0)
  })

  it('computes savings vs renting', () => {
    const r = calcHouseHack({ purchasePrice: 240000, units: 3, unitRents: [1100, 1050], monthlyPiti: 1650, marketRentOwner: 1300 })
    // effectiveMonthlyCost = -500, market = 1300, savings = 1800/mo
    expect(r.annualSavingsVsRenting).toBeCloseTo((1300 - (1650 - 2150)) * 12, 0)
  })
})

describe('calcLeaseOption', () => {
  it('computes cash flow and ROI for both scenarios', () => {
    const r = calcLeaseOption({
      allInPrice: 130000, optionPrice: 175000, optionFee: 5000,
      monthlyRent: 1400, rentCreditPct: 0.15, optionTermMonths: 36, monthlyOpex: 350
    })
    expect(r.strategy).toBe('LeaseOption')
    expect(r.cashFlowMonthly).toBeCloseTo(1400 - (1400 * 0.15) - 350, 0)
    expect(r.totalRentCollected).toBeCloseTo(1400 * 36, 0)
    expect(r.totalRentCredits).toBeCloseTo(1400 * 0.15 * 36, 0)
    expect(r.ok).toBe(true)
  })

  it('exercised scenario return is higher than non-exercised for positive-spread deal', () => {
    const r = calcLeaseOption({
      allInPrice: 130000, optionPrice: 175000, optionFee: 5000,
      monthlyRent: 1400, rentCreditPct: 0.15, optionTermMonths: 36, monthlyOpex: 350
    })
    expect(r.totalReturnIfExercised).toBeGreaterThan(r.totalReturnIfNot)
  })
})

describe('calcCreative', () => {
  it('computes monthly PI and cash flow correctly', () => {
    const r = calcCreative({
      purchasePrice: 150000, downPmt: 15000, interestRate: 0.065, termYears: 30,
      monthlyRent: 1500, annualOpex: 8000
    })
    expect(r.strategy).toBe('Creative')
    expect(r.loan).toBe(135000)
    expect(r.monthlyPI).toBeGreaterThan(0)
    expect(r.grossAnnual).toBe(18000)
    expect(r.ok).toBe(true)
  })

  it('computes balloon balance at specified year', () => {
    const r = calcCreative({
      purchasePrice: 150000, downPmt: 15000, interestRate: 0.065,
      termYears: 30, balloonYears: 5, exitArv: 190000
    })
    expect(r.balloonBalance).toBeGreaterThan(0)
    expect(r.balloonBalance).toBeLessThan(135000)  // some principal paid
    expect(r.balloonEquity).toBeCloseTo(190000 - r.balloonBalance, 0)
  })

  it('computes cash-on-cash return', () => {
    const r = calcCreative({
      purchasePrice: 150000, downPmt: 15000, interestRate: 0.065,
      termYears: 30, monthlyRent: 1500, annualOpex: 8000
    })
    expect(r.cashOnCash).toBeDefined()
    expect(Number.isFinite(r.cashOnCash)).toBe(true)
  })
})
