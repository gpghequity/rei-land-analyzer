// Exit Strategy math — pure functions, no side effects.
// All strategies are additive; no existing math files are imported or modified.
//
// Strategies:
//   calcSTR       — Short-Term Rental (Airbnb / VRBO)
//   calcMTR       — Medium-Term Rental (30–90 day: nurses, corporate)
//   calcBRRRR     — Buy, Rehab, Rent, Refinance, Repeat
//   calcCoLiving  — By-the-room / co-living
//   calcHouseHack — Owner-occupant + tenants cover mortgage (2–4 unit)
//   calcLeaseOption — Lease-option / rent-to-own (H4H model)
//   calcCreative  — Seller-finance / subject-to / creative terms

// ─────────────────────────────────── helpers ────────────────────────────────
function pmt(annualRate, termYears, principal) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 12
  const n = termYears * 12
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// ─────────────────────────────────── STR ────────────────────────────────────
// inputs:
//   nightlyRate      — avg nightly rate ($)
//   occupancyPct     — 0–1 (e.g. 0.65)
//   avgStayNights    — avg booking length in nights (default 3)
//   cleaningFee      — per-turn cleaning cost ($, default 85)
//   platformFeePct   — host-side platform fee (default 0.03 for Airbnb)
//   annualOpex       — annual operating expenses (taxes, ins, utilities, mgmt, $)
//   allInPrice       — total all-in cost (purchase + rehab, $); 0 = skip cap rate
export function calcSTR({
  nightlyRate, occupancyPct, avgStayNights = 3,
  cleaningFee = 85, platformFeePct = 0.03,
  annualOpex, allInPrice = 0
}) {
  const n = parseFloat(nightlyRate) || 0
  const occ = parseFloat(occupancyPct) || 0
  const opex = parseFloat(annualOpex) || 0
  const price = parseFloat(allInPrice) || 0

  const occupiedNights = 365 * occ
  const grossRevenue = n * occupiedNights
  const platformFees = grossRevenue * platformFeePct
  const turns = avgStayNights > 0 ? occupiedNights / avgStayNights : occupiedNights / 3
  const cleaningCosts = turns * cleaningFee
  const effectiveRevenue = grossRevenue - platformFees - cleaningCosts
  const noi = effectiveRevenue - opex
  const revpar = occupiedNights > 0 ? grossRevenue / 365 : 0  // revenue per available room/night
  const capRate = price > 0 ? noi / price : null
  const grm = price > 0 && grossRevenue > 0 ? price / grossRevenue : null  // lower is better

  return {
    strategy: 'STR',
    occupiedNights: Math.round(occupiedNights),
    grossRevenue,
    platformFees,
    cleaningCosts,
    turns: Math.round(turns),
    effectiveRevenue,
    noi,
    revpar,
    capRate,
    grm,
    monthlyNetIncome: noi / 12,
    ok: noi > 0
  }
}

// ─────────────────────────────────── MTR ────────────────────────────────────
// inputs:
//   monthlyRate      — furnished monthly rate ($)
//   occupancyPct     — 0–1 (travel nurses typical: 0.88–0.92)
//   ltrComparison    — unfurnished LTR monthly rate for comparison ($)
//   furnishingCost   — one-time furnishing setup cost ($)
//   annualOpex       — taxes, insurance, mgmt, maintenance, utilities ($)
//   allInPrice       — purchase + rehab ($); 0 = skip cap rate
export function calcMTR({
  monthlyRate, occupancyPct, ltrComparison = 0,
  furnishingCost = 0, annualOpex, allInPrice = 0
}) {
  const mo = parseFloat(monthlyRate) || 0
  const occ = parseFloat(occupancyPct) || 0
  const opex = parseFloat(annualOpex) || 0
  const price = parseFloat(allInPrice) || 0
  const ltr = parseFloat(ltrComparison) || 0
  const furnish = parseFloat(furnishingCost) || 0

  const grossAnnual = mo * 12 * occ
  const noi = grossAnnual - opex
  const premiumVsLtr = ltr > 0 ? mo - ltr : null
  const premiumPct = ltr > 0 ? (mo - ltr) / ltr : null
  const capRate = price > 0 ? noi / price : null
  const furnishingPayback = furnish > 0 && premiumVsLtr > 0 ? furnish / (premiumVsLtr * 12) : null

  return {
    strategy: 'MTR',
    grossAnnual,
    noi,
    monthlyNetIncome: noi / 12,
    premiumVsLtr,
    premiumPct,
    capRate,
    furnishingPayback,  // years to recover furnishing cost via premium
    ok: noi > 0
  }
}

// ─────────────────────────────────── BRRRR ──────────────────────────────────
// inputs:
//   purchasePrice    — acquisition cost ($)
//   rehabCost        — total rehab budget ($)
//   closingCostsBuy  — buy-side closing costs ($, default 3%)
//   monthlyRent      — stabilized monthly gross rent ($)
//   expenseRatioPct  — 0–1 (default 0.40 — 40% expense ratio is standard)
//   arv              — after-repair value ($)
//   ltvPct           — refinance LTV (default 0.75)
//   refiRate         — refinance interest rate (default 0.075)
//   refiTermYears    — amortization years (default 30)
export function calcBRRRR({
  purchasePrice, rehabCost, closingCostsBuy = null,
  monthlyRent, expenseRatioPct = 0.40,
  arv, ltvPct = 0.75, refiRate = 0.075, refiTermYears = 30
}) {
  const purchase = parseFloat(purchasePrice) || 0
  const rehab = parseFloat(rehabCost) || 0
  const closing = closingCostsBuy != null ? parseFloat(closingCostsBuy) : purchase * 0.03
  const rent = parseFloat(monthlyRent) || 0
  const arvV = parseFloat(arv) || 0
  const ltv = parseFloat(ltvPct) || 0.75

  const allIn = purchase + rehab + closing
  const grossAnnual = rent * 12
  const noi = grossAnnual * (1 - expenseRatioPct)

  const refiLoan = arvV * ltv
  const refiMonthlyPI = pmt(refiRate, refiTermYears, refiLoan)
  const refiAnnualDS = refiMonthlyPI * 12

  const cashPulledOut = refiLoan - (purchase + closing)
  const cashLeftIn = allIn - refiLoan
  const equityCreated = arvV - allIn
  const annualCashFlow = noi - refiAnnualDS
  const cashOnCash = cashLeftIn > 0 ? annualCashFlow / cashLeftIn : null
  const dscr = refiAnnualDS > 0 ? noi / refiAnnualDS : null

  const brrrrWorks = cashLeftIn <= 0  // true = infinite return (pulled out all cash + more)
  const recycleEfficiency = allIn > 0 ? refiLoan / allIn : 0  // how much capital recycled

  return {
    strategy: 'BRRRR',
    allIn,
    purchase,
    rehab,
    closing,
    grossAnnual,
    noi,
    arv: arvV,
    refiLoan,
    refiMonthlyPI,
    refiAnnualDS,
    cashPulledOut,
    cashLeftIn,
    equityCreated,
    annualCashFlow,
    cashOnCash,
    dscr,
    recycleEfficiency,
    brrrrWorks,
    ok: noi > 0 && arvV > 0
  }
}

// ─────────────────────────────────── CO-LIVING ──────────────────────────────
// inputs:
//   bedrooms         — total rentable bedrooms (int)
//   perRoomRent      — monthly per-room rent ($)
//   occupancyPct     — 0–1 (typical 0.90–0.95)
//   wholeHouseLtr    — comparable whole-house LTR monthly ($) for benchmark
//   annualOpex       — operating expenses ($)
//   allInPrice       — purchase + rehab ($)
//   managementNote   — free text (not used in math; returned for display)
export function calcCoLiving({
  bedrooms, perRoomRent, occupancyPct, wholeHouseLtr = 0,
  annualOpex, allInPrice = 0
}) {
  const bds = parseInt(bedrooms) || 0
  const roomRent = parseFloat(perRoomRent) || 0
  const occ = parseFloat(occupancyPct) || 0
  const opex = parseFloat(annualOpex) || 0
  const price = parseFloat(allInPrice) || 0
  const ltr = parseFloat(wholeHouseLtr) || 0

  const grossAnnual = bds * roomRent * 12 * occ
  const noi = grossAnnual - opex
  const capRate = price > 0 ? noi / price : null
  const vsLtrAnnual = ltr > 0 ? grossAnnual - (ltr * 12) : null
  const premiumPct = ltr > 0 ? ((bds * roomRent) - ltr) / ltr : null

  return {
    strategy: 'CoLiving',
    bedrooms: bds,
    grossAnnual,
    noi,
    monthlyNetIncome: noi / 12,
    capRate,
    vsLtrAnnual,
    premiumPct,
    effectiveMonthlyPerRoom: roomRent * occ,
    ok: noi > 0
  }
}

// ─────────────────────────────────── HOUSE HACK ─────────────────────────────
// inputs:
//   purchasePrice    — property price ($)
//   units            — total units (2–4)
//   unitRents        — array of monthly rents for tenant units (not owner's unit)
//   monthlyPiti      — owner's PITI payment ($)
//   marketRentOwner  — what owner would pay renting elsewhere (for savings calc)
export function calcHouseHack({
  purchasePrice, units, unitRents, monthlyPiti, marketRentOwner = 0
}) {
  const price = parseFloat(purchasePrice) || 0
  const piti = parseFloat(monthlyPiti) || 0
  const market = parseFloat(marketRentOwner) || 0
  const rents = (unitRents || []).map(r => parseFloat(r) || 0).filter(r => r > 0)

  const rentalIncomeMo = rents.reduce((s, r) => s + r, 0)
  const rentalIncomeAnn = rentalIncomeMo * 12
  const effectiveMonthlyCost = piti - rentalIncomeMo
  const annualSavingsVsRenting = market > 0 ? (market - effectiveMonthlyCost) * 12 : null
  const tenantCoversPct = piti > 0 ? rentalIncomeMo / piti : 0
  const freeLiving = effectiveMonthlyCost <= 0  // tenants more than cover PITI

  return {
    strategy: 'HouseHack',
    units: parseInt(units) || 2,
    rentalIncomeMo,
    rentalIncomeAnn,
    effectiveMonthlyCost,
    annualSavingsVsRenting,
    tenantCoversPct,
    freeLiving,
    ok: rentalIncomeMo > 0
  }
}

// ─────────────────────────────────── LEASE OPTION ───────────────────────────
// H4H / rent-to-own model.
// inputs:
//   allInPrice       — investor's total cost (purchase + rehab, $)
//   optionPrice      — price the tenant-buyer has the right to purchase at ($)
//   optionFee        — upfront non-refundable option consideration ($)
//   monthlyRent      — monthly rent ($)
//   rentCreditPct    — 0–1 portion of rent that credits toward purchase (e.g. 0.15)
//   optionTermMonths — option term in months (e.g. 24–60)
//   monthlyOpex      — monthly holding costs paid by investor (if landlord covers any)
export function calcLeaseOption({
  allInPrice, optionPrice, optionFee,
  monthlyRent, rentCreditPct = 0.15,
  optionTermMonths, monthlyOpex = 0
}) {
  const price = parseFloat(allInPrice) || 0
  const optPrice = parseFloat(optionPrice) || 0
  const fee = parseFloat(optionFee) || 0
  const mo = parseFloat(monthlyRent) || 0
  const creditPct = parseFloat(rentCreditPct) || 0
  const term = parseFloat(optionTermMonths) || 0
  const opexMo = parseFloat(monthlyOpex) || 0

  const totalRentCollected = mo * term
  const totalRentCredits = mo * creditPct * term
  const cashFlowMonthly = mo - (mo * creditPct) - opexMo  // net cash each month
  const totalCashFlow = cashFlowMonthly * term

  // Scenario A: tenant-buyer exercises option
  const saleProceeds = optPrice - totalRentCredits  // effective net from exercise
  const totalReturnIfExercised = fee + totalCashFlow + (saleProceeds - price)
  const roiIfExercised = price > 0 ? totalReturnIfExercised / price : null

  // Scenario B: tenant-buyer does NOT exercise — keep fee + cash flow, re-list
  const totalReturnIfNot = fee + totalCashFlow
  const roiIfNot = price > 0 ? totalReturnIfNot / price : null

  const effectiveYieldIfExercised = term > 0 && price > 0
    ? (totalReturnIfExercised / price) / (term / 12) : null

  return {
    strategy: 'LeaseOption',
    optionFee: fee,
    totalRentCollected,
    totalRentCredits,
    cashFlowMonthly,
    totalCashFlow,
    saleProceeds,
    totalReturnIfExercised,
    totalReturnIfNot,
    roiIfExercised,
    roiIfNot,
    effectiveYieldIfExercised,
    ok: fee > 0 && mo > 0
  }
}

// ─────────────────────────────────── CREATIVE FINANCE ───────────────────────
// Seller-finance or subject-to analysis.
// inputs:
//   purchasePrice    — negotiated price ($)
//   downPmt          — down payment ($)
//   interestRate     — annual interest rate (0–1)
//   termYears        — loan term / amortization years
//   monthlyRent      — if holding as rental ($)
//   annualOpex       — if holding ($)
//   balloonYears     — if balloon (0 = fully amortizing / no balloon)
//   exitArv          — expected ARV at sale / balloon refinance ($)
export function calcCreative({
  purchasePrice, downPmt, interestRate, termYears,
  monthlyRent = 0, annualOpex = 0,
  balloonYears = 0, exitArv = 0
}) {
  const price = parseFloat(purchasePrice) || 0
  const down = parseFloat(downPmt) || 0
  const rate = parseFloat(interestRate) || 0
  const term = parseFloat(termYears) || 30
  const rent = parseFloat(monthlyRent) || 0
  const opex = parseFloat(annualOpex) || 0
  const balloon = parseFloat(balloonYears) || 0
  const arv = parseFloat(exitArv) || 0

  const loan = price - down
  const monthlyPI = pmt(rate, term, loan)
  const annualDS = monthlyPI * 12
  const grossAnnual = rent * 12
  const noi = grossAnnual - opex
  const annualCashFlow = noi - annualDS
  const cashOnCash = down > 0 ? annualCashFlow / down : null
  const dscr = annualDS > 0 ? noi / annualDS : null

  // Balloon balance calculation
  let balloonBalance = null
  let balloonEquity = null
  if (balloon > 0 && loan > 0) {
    const r = rate / 12
    const n = term * 12
    const k = balloon * 12
    if (rate > 0) {
      balloonBalance = loan * Math.pow(1 + r, k) - monthlyPI * (Math.pow(1 + r, k) - 1) / r
    } else {
      balloonBalance = loan - (loan / n) * k
    }
    balloonEquity = arv > 0 ? arv - balloonBalance : null
  }

  const equityAtPurchase = arv > 0 ? arv - price : null

  return {
    strategy: 'Creative',
    purchasePrice: price,
    down,
    loan,
    rate,
    term,
    monthlyPI,
    annualDS,
    grossAnnual,
    noi,
    annualCashFlow,
    cashOnCash,
    dscr,
    balloonBalance,
    balloonEquity,
    equityAtPurchase,
    ok: loan > 0 && rate >= 0
  }
}
