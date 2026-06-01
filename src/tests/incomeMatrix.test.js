import { describe, it, expect } from 'vitest'
import { buildIncomeMatrix, INCOME_ASSET_TYPES, bankTermsFor } from '../components/analyze/incomeMatrix.js'
import { loadConstants } from '../math/constants.js'

const C = loadConstants()
const NOI = 100000

describe('Income financing matrix (standard report for all NOI assets)', () => {
  for (const assetType of INCOME_ASSET_TYPES) {
    describe(assetType, () => {
      const { rows, summary, assumptions } = buildIncomeMatrix({ assetType, noi: NOI })
      const terms = bankTermsFor(assetType, C)

      it('produces exactly 8 rows (4 structures × 2 DSCR)', () => {
        expect(rows).toHaveLength(8)
        expect(rows.filter(r => r.dscr === 1.25)).toHaveLength(4)
        expect(rows.filter(r => r.dscr === 1.15)).toHaveLength(4)
      })

      it('bank loan is DSCR-sized and bank always funds the LTV share', () => {
        for (const r of rows) {
          // bank loan ≈ noi/(dscr×K), within rounding of the offer to $1k
          expect(Math.abs(r.bank - r.offer * terms.ltv)).toBeLessThanOrEqual(1000)
          expect(r.bank).toBeGreaterThan(0)
        }
      })

      it('borrower equity = offer − bank on every row (shown even when cost is 0)', () => {
        const bankOnly = rows.filter(r => r.structureKey === 'bank_only')
        for (const r of bankOnly) {
          expect(r.borrower).toBe(r.offer - r.bank)
          expect(r.borrowerCost).toBe(0)        // bank-only: no equity cost, but equity still shown
          expect(r.borrower).toBeGreaterThan(0)
        }
      })

      it('equity cost applies ONLY to the equity gap, never the full price', () => {
        const io = rows.filter(r => r.structureKey === 'equity_io')
        for (const r of io) {
          const equity = r.offer - r.bank
          expect(Math.round(r.borrowerCost)).toBe(Math.round(equity * C.K_OWNER_IO))
          expect(r.borrowerCost).toBeLessThan(r.offer * C.K_OWNER_IO) // not applied to full price
        }
      })

      it('$100k + seller: buyer cash $100k, seller note = equity − 100k, balloon present', () => {
        const seller = rows.filter(r => r.structureKey === 'seller_fi')
        for (const r of seller) {
          const equity = r.offer - r.bank
          expect(r.borrower).toBe(Math.min(100000, equity))
          expect(r.sellerFi).toBe(Math.max(0, equity - 100000))
          // buyer cost only on the $100k, never the full equity or price
          expect(Math.round(r.borrowerCost)).toBe(Math.round(Math.min(100000, equity) * C.K_OWNER_IO))
          if (r.sellerFi > 0) {
            expect(r.sellerPayment).toBeCloseTo(r.sellerFi * C.K_SELLER, 0)
            expect(r.balloon).toBeGreaterThan(0)
            expect(r.balloon).toBeLessThan(r.sellerFi) // balloon < original note after 15yr paydown
          }
        }
      })

      it('pocket money = NOI − total capital cost on every row', () => {
        for (const r of rows) {
          expect(Math.round(r.pocketMoney)).toBe(Math.round(NOI - r.totalCapitalCost))
          expect(Math.round(r.totalCapitalCost)).toBe(Math.round(r.bankPayment + r.borrowerCost + r.sellerPayment))
        }
      })

      it('aggressive (1.15) supports a higher offer than conservative (1.25)', () => {
        expect(summary.aggressiveValue).toBeGreaterThan(summary.conservativeValue)
      })

      it('documents the asset-correct bank LTV (0.75 — never 0.70)', () => {
        expect(assumptions.bankLtv).toBe(terms.ltv)
        expect(assumptions.bankLtv).toBe(0.75) // storage / MF-20+ / commercial all 75/25 here
      })
    })
  }
})
