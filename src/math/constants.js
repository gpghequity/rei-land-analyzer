// READING FROM shared-underwriting-standards (single source of truth)
// Updated 2026-06-09: Removed local defaults.json snapshot, now reads live from platform standards
// All tools (Baby Analyzer, Fast Calc, Lender Command, etc.) use same constants from shared pkg.

import STANDARDS from 'shared-underwriting-standards'

export function loadConstants() {
  const flat = {}

  // Flatten RESIDENTIAL standards
  const RES = STANDARDS.RESIDENTIAL || {}
  flat.RATE_BANK_RESI = RES.mortgageRate
  flat.AMORT_BANK_RESI = RES.amortizationYears
  flat.LTV_RESI = RES.ltv
  flat.DSCR_RESI = RES.dscr

  // Flatten STORAGE standards
  const STOR = STANDARDS.STORAGE || {}
  flat.RATE_BANK_STORAGE = STOR.mortgageRate
  flat.AMORT_BANK_STORAGE = STOR.amortizationYears
  flat.LTV_STORAGE = STOR.ltv
  flat.DSCR_CONSERVATIVE = STOR.dscrConservative || 1.25
  flat.DSCR_STRETCH = STOR.dscrStretch || 1.15

  // Flatten GLOBAL constants
  const GLOB = STANDARDS.GLOBAL || {}
  flat.POCKET_FLOOR = GLOB.pocketCashFloor || 10000
  flat.EXPENSE_FLOOR = 0.35

  // Calculate K constants from rates + amortization
  flat.K_BANK_STORAGE = annualLoanConstant(flat.RATE_BANK_STORAGE, flat.AMORT_BANK_STORAGE)
  flat.K_BANK_RESI    = annualLoanConstant(flat.RATE_BANK_RESI,    flat.AMORT_BANK_RESI)
  flat.K_OWNER_IO     = 0.08
  flat.K_OWNER_AMORT  = annualLoanConstant(0.08, 25)

  // Seller-finance constants (Math Bible group B financing)
  flat.RATE_SELLER    = 0.05                                       // 5% seller note rate
  flat.AMORT_SELLER   = 25                                         // 25-year amortization
  flat.K_SELLER       = annualLoanConstant(flat.RATE_SELLER, flat.AMORT_SELLER)

  // Closing costs and fees (equity requirement line items)
  flat.WHOLESALE_FEE  = 10000                                      // $10k assignment fee
  flat.BANK_POINTS_PCT = 0.01                                      // 1% lender points
  flat.BANK_LENDER_FEES = 2500                                     // $2.5k flat lender fee
  flat.LEGAL          = 3000                                       // $3k legal cost
  flat.TITLE_PCT      = 0.005                                      // 0.5% title insurance
  flat.ENVIRONMENTAL  = 500                                        // $500 environmental inspection
  flat.APPRAISAL      = 600                                        // $600 appraisal
  flat.SURVEY         = 800                                        // $800 survey
  flat.INSURANCE_SETUP = 400                                       // $400 insurance setup
  flat.PITI_RESERVE_MONTHS = 3                                     // 3 months PITI/tax reserve
  flat.WORKING_CAPITAL_PCT = 0.10                                  // 10% working capital reserve

  return flat
}

export function annualLoanConstant(annualRate, amortYears) {
  const r = annualRate / 12
  const n = amortYears * 12
  const monthlyFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return monthlyFactor * 12
}
