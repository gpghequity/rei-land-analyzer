// THE NUMBERS THIS ENGINE USES — ALL FROM THE LIVE BIBLE.
//
// Steve's rule (2026-07-16): "Every time an app is opened it looks at the Bible.
// Every time it wants a calculation it gets it from the Bible. The Bible owns
// everything." So this file holds ZERO underwriting numbers of its own.
//
// HOW IT WORKS
//   - The app boots by fetching the live Bible (shared-underwriting-standards/
//     bible-client, fail-closed) and calling setBible(standards) ONCE before any
//     tab renders (see src/main.jsx). It re-fetches + re-seeds on focus/interval,
//     so a new Bible reaches the running app without a rebuild.
//   - loadConstants() reads that in-memory live Bible and throws if it is not
//     present, so no calculation can run on numbers that never came from the Bible.
//   - Every value is read from an EXACT Bible key. There are NO `|| x` / `?? x`
//     fallbacks. A `|| 0.04`-style fallback is exactly the bug class we are killing:
//     it turns a dead/renamed Bible key into a silent wrong number instead of a
//     loud failure. If a key the engine needs is missing, this THROWS by name.
//
// BANNED: a build-time `import STD from 'shared-underwriting-standards'`. That bakes
// a photocopy of the Bible into the bundle and freezes the app on the Bible as of
// its last build — the reason four months of "fixes" kept failing. Tests MAY seed a
// Bible (a test is not the app); see src/tests/setup.js.

// The in-memory live Bible standards object. Populated by setBible() at launch.
let _bible = null

// Seed the live Bible. Called by the app bootstrap (main.jsx) after a successful
// fetch, and by the test setup. Passing anything but a standards object throws.
export function setBible(standards) {
  if (!standards || typeof standards !== 'object' || !standards.GLOBAL || !standards.RESIDENTIAL) {
    throw new Error('setBible: a valid Bible standards object is required (missing GLOBAL/RESIDENTIAL).')
  }
  _bible = standards
}

export function clearBible() { _bible = null }
export function hasBible() { return _bible != null }

// Fail-closed accessor. Every numeric read goes through num() so a missing or
// non-finite Bible value throws BY NAME instead of poisoning the math with NaN.
function requireBible() {
  if (!_bible) {
    throw new Error(
      'BIBLE UNAVAILABLE — refusing to calculate. The live Bible was never seeded ' +
      '(setBible was not called). No fallback is used on purpose: a stale/guessed ' +
      'number is worse than no answer.'
    )
  }
  return _bible
}

function num(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Bible missing or non-numeric: ${name} (got ${v === undefined ? 'undefined' : JSON.stringify(v)}). Refusing to guess.`)
  }
  return v
}

export function loadConstants() {
  const B = requireBible()
  const GLOB = B.GLOBAL
  const RES = B.RESIDENTIAL
  const STOR = B.STORAGE
  const COMM = B.COMMERCIAL
  const CC = B.CLOSING_COSTS
  const REFI = B.REFI
  const GROWTH = B.GROWTH

  if (!GLOB || !RES || !STOR || !COMM || !CC || !REFI || !GROWTH) {
    throw new Error('Bible is missing a required top-level section (GLOBAL/RESIDENTIAL/STORAGE/COMMERCIAL/CLOSING_COSTS/REFI/GROWTH).')
  }

  const flat = {}

  // ── RESIDENTIAL bank terms ────────────────────────────────────────────────
  flat.RATE_BANK_RESI = num(RES.mortgageRate, 'RESIDENTIAL.mortgageRate')
  flat.AMORT_BANK_RESI = num(RES.amortizationYears, 'RESIDENTIAL.amortizationYears')
  flat.LTV_RESI = num(RES.ltv, 'RESIDENTIAL.ltv')
  // Bible RESIDENTIAL.dscr is a single number (1.25). Was `RES.dscr || 1.25`, which
  // would have silently produced 1.25 if the key were an object/undefined — the bug
  // class. Read it directly and throw if it is not a finite number.
  flat.DSCR_RESI = num(RES.dscr, 'RESIDENTIAL.dscr')

  // ── STORAGE bank terms ────────────────────────────────────────────────────
  flat.RATE_BANK_STORAGE = num(STOR.mortgageRate, 'STORAGE.mortgageRate')
  flat.AMORT_BANK_STORAGE = num(STOR.amortizationYears, 'STORAGE.amortizationYears')
  flat.LTV_STORAGE = num(STOR.ltv, 'STORAGE.ltv')
  // Bible STORAGE.dscr is an object { standard, stretch }. The old code read
  // STOR.dscrConservative / STOR.dscrStretch — keys that DO NOT EXIST — and fell
  // back to `|| 1.25` / `|| 1.15`. Dead-key + fallback = the bug class (it only
  // happened to land on the right numbers). Read the real object keys.
  flat.DSCR_CONSERVATIVE = num(STOR.dscr && STOR.dscr.standard, 'STORAGE.dscr.standard')
  flat.DSCR_STRETCH = num(STOR.dscr && STOR.dscr.stretch, 'STORAGE.dscr.stretch')

  // ── COMMERCIAL bank terms (income-property matrix) ────────────────────────
  // Homed so incomeMatrix stops pricing commercial at a hardcoded 7% / 30yr.
  flat.RATE_BANK_COMMERCIAL = num(COMM.mortgageRate, 'COMMERCIAL.mortgageRate')       // 0.0725
  flat.AMORT_BANK_COMMERCIAL = num(COMM.amortizationYears, 'COMMERCIAL.amortizationYears') // 25
  flat.LTV_COMMERCIAL = num(COMM.ltv, 'COMMERCIAL.ltv')                               // 0.75

  // ── Floors ────────────────────────────────────────────────────────────────
  flat.POCKET_FLOOR = num(GLOB.pocketCashFloor, 'GLOBAL.pocketCashFloor')
  flat.EXPENSE_FLOOR = num(STOR.expenseFloor, 'STORAGE.expenseFloor')
  flat.STORAGE_EXPENSE_FLOOR = flat.EXPENSE_FLOOR   // StorageTab references this name

  // ── Derived loan constants ────────────────────────────────────────────────
  flat.K_BANK_STORAGE = annualLoanConstant(flat.RATE_BANK_STORAGE, flat.AMORT_BANK_STORAGE)
  flat.K_BANK_RESI = annualLoanConstant(flat.RATE_BANK_RESI, flat.AMORT_BANK_RESI)
  flat.K_BANK_COMMERCIAL = annualLoanConstant(flat.RATE_BANK_COMMERCIAL, flat.AMORT_BANK_COMMERCIAL)

  // ── Owner-equity treatment (interest-only / amortized) ────────────────────
  // 8% owner-financing rate; amortized term from the Bible's storage capital-stack
  // scenario (groupA_v3 amortized-equity term = 25yr @ 8%).
  const ownerRate = num(RES.ownerFinanceRate, 'RESIDENTIAL.ownerFinanceRate')  // 0.08
  const ownerAmortTerm = num(
    STOR.scenarios && STOR.scenarios.groupA_v3_1_25 && STOR.scenarios.groupA_v3_1_25.equityTerm,
    'STORAGE.scenarios.groupA_v3_1_25.equityTerm'
  ) // 25
  flat.K_OWNER_IO = ownerRate
  flat.K_OWNER_AMORT = annualLoanConstant(ownerRate, ownerAmortTerm)

  // ── Seller-finance (storage/commercial seller note: 5% / 25yr) ────────────
  flat.RATE_SELLER = num(STOR.sellerFinance && STOR.sellerFinance.rate, 'STORAGE.sellerFinance.rate')       // 0.05
  flat.AMORT_SELLER = num(STOR.sellerFinance && STOR.sellerFinance.amortYears, 'STORAGE.sellerFinance.amortYears') // 25
  flat.K_SELLER = annualLoanConstant(flat.RATE_SELLER, flat.AMORT_SELLER)

  // ── Closing / fee line items (equity requirement) ─────────────────────────
  flat.WHOLESALE_FEE = num(GLOB.wholesaleFeeAmount, 'GLOBAL.wholesaleFeeAmount')
  flat.CLOSING_COSTS = num(GLOB.closingCostsFlatAmount, 'GLOBAL.closingCostsFlatAmount')
  flat.TITLE_PCT = num(GLOB.titleEscrowRecordingPercent, 'GLOBAL.titleEscrowRecordingPercent')
  flat.TRANSFER_TAX_PCT = num(GLOB.transferTaxPercent, 'GLOBAL.transferTaxPercent')
  flat.APPRAISAL = num(CC.appraisalFee, 'CLOSING_COSTS.appraisalFee')                 // 4000 (was hardcoded 4500)
  flat.SURVEY = num(CC.surveyFee, 'CLOSING_COSTS.surveyFee')                          // 800
  flat.LEGAL = num(CC.legalFee, 'CLOSING_COSTS.legalFee')                             // 3000
  flat.ENVIRONMENTAL = num(CC.environmentalFee, 'CLOSING_COSTS.environmentalFee')     // 3500 (was hardcoded 500 — 7x low)
  flat.INSURANCE_SETUP = num(CC.insuranceSetupFee, 'CLOSING_COSTS.insuranceSetupFee') // 400
  flat.BANK_POINTS_PCT = num(CC.bankPointsPct, 'CLOSING_COSTS.bankPointsPct')         // 0.01
  // SHAPE FIX: lender fees are a PERCENT of the bank loan (Bible CLOSING_COSTS.
  // lenderFeesPct = 0.01), not a flat $2,500. storage.js multiplies by bankLoan.
  flat.BANK_LENDER_FEES_PCT = num(CC.lenderFeesPct, 'CLOSING_COSTS.lenderFeesPct')    // 0.01
  flat.PITI_RESERVE_MONTHS = num(STOR.pitiReserveMonths, 'STORAGE.pitiReserveMonths') // 3
  flat.WORKING_CAPITAL_PCT = num(STOR.workingCapitalPct, 'STORAGE.workingCapitalPct') // 0.25

  // ── Residential MVM pads (0% / 15% / 30%) ─────────────────────────────────
  flat.PAD_LIGHT = num(RES.expensePads && RES.expensePads.light, 'RESIDENTIAL.expensePads.light')       // 0
  flat.PAD_STANDARD = num(RES.expensePads && RES.expensePads.standard, 'RESIDENTIAL.expensePads.standard') // 0.15 (was 0.20)
  flat.PAD_HARSH = num(RES.expensePads && RES.expensePads.harsh, 'RESIDENTIAL.expensePads.harsh')       // 0.30 (was 0.33)

  // ── Residential MAO / ARV ─────────────────────────────────────────────────
  flat.MAO_FACTOR = num(RES.arvMultiplier, 'RESIDENTIAL.arvMultiplier')          // 0.70
  flat.CLOSING_RESI = num(GLOB.closingCostsFlatAmount, 'GLOBAL.closingCostsFlatAmount') // 2000
  flat.RATE_OWNER = ownerRate                                                    // 0.08
  flat.ARV_MIN_COMPS = num(GLOB.arvMinComps, 'GLOBAL.arvMinComps')               // 3
  flat.ARV_PERCENTILE = num(GLOB.arvPercentile, 'GLOBAL.arvPercentile')          // 0.40 (40th percentile rule)

  // ── Flipper projection (were undefined -> NaN on screen) ──────────────────
  flat.SELLING_COSTS_PCT = num(GLOB.sellingCostsPercent, 'GLOBAL.sellingCostsPercent') // 0.08
  flat.HOLDING_PER_MONTH = num(GLOB.holdingCostPerMonth, 'GLOBAL.holdingCostPerMonth') // 350
  flat.HOLDING_MONTHS = num(GLOB.holdingMonthsDefault, 'GLOBAL.holdingMonthsDefault')  // 6

  // ── Seller kicker projection (were undefined -> NaN on screen) ────────────
  flat.PCT_DEFAULT = num(STOR.sellerKicker && STOR.sellerKicker.pctDefault, 'STORAGE.sellerKicker.pctDefault')     // 0.20
  flat.CAP_DEFAULT = num(STOR.sellerKicker && STOR.sellerKicker.capCumulative, 'STORAGE.sellerKicker.capCumulative') // 50000
  flat.WINDOW_YEARS = num(STOR.sellerKicker && STOR.sellerKicker.windowYears, 'STORAGE.sellerKicker.windowYears')  // 5
  flat.KICKER_DEFAULT = num(GROWTH.noiStretch, 'GROWTH.noiStretch')              // 0.05 default growth lens

  // ── Growth / refinance takeout ────────────────────────────────────────────
  flat.NOI_GROWTH_CONSERVATIVE = num(GROWTH.noiConservative, 'GROWTH.noiConservative') // 0.03
  // Refi takeout: 7.25% / 15yr (was hardcoded 6.5% — understated refi debt service).
  flat.K_REFI_15 = annualLoanConstant(
    num(REFI.mortgageRate, 'REFI.mortgageRate'),
    num(REFI.amortizationYears, 'REFI.amortizationYears')
  )

  // ── $100k-buyer + seller-finance structure (income matrix) ────────────────
  flat.BUYER_CASH_FIXED = num(RES.sellerFinance && RES.sellerFinance.buyerCashFixed, 'RESIDENTIAL.sellerFinance.buyerCashFixed')   // 100000
  flat.SELLER_BALLOON_YEARS = num(RES.sellerFinance && RES.sellerFinance.balloonYears, 'RESIDENTIAL.sellerFinance.balloonYears')   // 15

  return flat
}

export function annualLoanConstant(annualRate, amortYears) {
  const r = annualRate / 12
  const n = amortYears * 12
  const monthlyFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return monthlyFactor * 12
}
