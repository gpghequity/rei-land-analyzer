import { describe, it, expect } from 'vitest'
import { PROPERTY_TYPES, getType, deriveNOI } from '../components/analyze/typeMap.js'

describe('Analyze workspace type map', () => {
  it('exposes the 8 supported types (MF split into tiers) and excludes Lending', () => {
    const ids = PROPERTY_TYPES.map(t => t.id)
    expect(ids).toEqual([
      'residential', 'self_storage', 'multifamily_small', 'multifamily_large',
      'commercial', 'mhp_rv', 'mixed_use', 'ios_land'
    ])
    expect(ids).not.toContain('lending')
    expect(ids).not.toContain('multifamily') // replaced by the two tiers
  })

  it('routes MF 1-19 through multifamily_small (agency 80/20 @ 7%/30yr)', () => {
    const calc = getType('multifamily_small').buildCalc({ noi: 120000 })
    expect(calc.type).toBe('multifamily_small')
    expect(calc.inputs.noi).toBe(120000)
  })

  it('routes MF 20+ through multifamily_large (commercial 75/25 @ 7.25%/25yr)', () => {
    const calc = getType('multifamily_large').buildCalc({ noi: 120000 })
    expect(calc.type).toBe('multifamily_large')
    expect(calc.inputs.noi).toBe(120000)
  })

  it('routes Self Storage through storage_group_a', () => {
    expect(getType('self_storage').buildCalc({ noi: 90000 }).type).toBe('storage_group_a')
  })

  it('routes Commercial through commercial_dscr', () => {
    expect(getType('commercial').buildCalc({ noi: 200000 }).type).toBe('commercial_dscr')
  })

  it('routes MHP/RV through mhp_noi and chains to storage', () => {
    const calc = getType('mhp_rv').buildCalc({ lots: 40, lotRent: 350 })
    expect(calc.type).toBe('mhp_noi')
    expect(calc.chainToStorage).toBe(true)
  })

  it('residential flip uses MAO, rental uses DSCR', () => {
    const r = getType('residential')
    expect(r.buildCalc({ arv: 300000, rehab: 50000 }, 'flip').type).toBe('residential_mao')
    expect(r.buildCalc({ noi: 24000, purchase: 200000 }, 'rental').type).toBe('residential_dscr')
  })

  it('IOS/Land NEVER borrows storage (or any) math — land uses the Land/IOS tab', () => {
    const land = getType('ios_land')
    expect(land.implemented).toBe(false)
    expect(land.buildCalc({ noi: 0 })).toBeNull()           // raw land → no offer
    expect(land.buildCalc({ noi: 50000 })).toBeNull()       // even WITH income → no storage math here
  })

  it('deriveNOI: explicit NOI > Gross−Expenses($) > Gross×(1−ratio%), default 40%', () => {
    expect(deriveNOI({ noi: 100000 })).toBe(100000)
    expect(deriveNOI({ grossIncome: 100000, expenseRatio: 30 })).toBe(70000)
    expect(deriveNOI({ grossIncome: 100000 })).toBe(60000)
    expect(deriveNOI({})).toBe(0)
    // explicit expense dollars win over the ratio
    expect(deriveNOI({ grossIncome: 87000, expenses: 41000 })).toBe(46000)
    // fat-finger ratio (41000 meant as dollars) is out of range → falls back to 40%
    expect(deriveNOI({ grossIncome: 100000, expenseRatio: 41000 })).toBe(60000)
  })
})
