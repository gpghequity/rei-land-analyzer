// Vercel serverless function — regression-testable math endpoint.
// Self-contained: inlines Baby Analyzer math so Node runtime has no Vite deps.
// Called by rei-math-regression weekly. Not exposed in the UI.

// ── Read from canonical Bible at runtime (no local copies) ──
import { getBible } from '../../shared-underwriting-standards/bible-reader.js';
const BIBLE = getBible();

// Extract constants from Bible into local scope for calculation functions
const STORAGE_EXPENSE_FLOOR = BIBLE.GLOBAL.STORAGE_EXPENSE_FLOOR;
const LTV_STORAGE           = BIBLE.GLOBAL.LTV_STORAGE;
const LTV_RESI              = BIBLE.GLOBAL.LTV_RESI;
const LTV_COMMERCIAL        = BIBLE.GLOBAL.LTV_COMMERCIAL;
const RATE_BANK_STORAGE     = BIBLE.GLOBAL.RATE_BANK_STORAGE;
const AMORT_BANK_STORAGE    = BIBLE.GLOBAL.AMORT_BANK_STORAGE;
const RATE_BANK_RESI        = BIBLE.GLOBAL.RATE_BANK_RESI;
const AMORT_BANK_RESI       = BIBLE.GLOBAL.AMORT_BANK_RESI;
const RATE_BANK_COMMERCIAL  = BIBLE.GLOBAL.RATE_BANK_COMMERCIAL;
const AMORT_BANK_COMMERCIAL = BIBLE.GLOBAL.AMORT_BANK_COMMERCIAL;
const DSCR_CONSERVATIVE     = BIBLE.GLOBAL.DSCR_CONSERVATIVE;
const DSCR_STRETCH          = BIBLE.GLOBAL.DSCR_STRETCH;  // NOW READS FROM BIBLE: 1.15 (not hardcoded 1.10)
const MAO_FACTOR            = BIBLE.GLOBAL.arvMultiplier;
const WHOLESALE_FEE         = BIBLE.GLOBAL.WHOLESALE_FEE;
const POCKET_FLOOR          = BIBLE.GLOBAL.POCKET_FLOOR;

function annualK(rate, years) {
  const r = rate / 12, n = years * 12;
  const f = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return f * 12;
}

const K_BANK_STORAGE     = annualK(RATE_BANK_STORAGE, AMORT_BANK_STORAGE);
const K_BANK_RESI        = annualK(RATE_BANK_RESI,    AMORT_BANK_RESI);
const K_BANK_COMMERCIAL  = annualK(RATE_BANK_COMMERCIAL, AMORT_BANK_COMMERCIAL);

// Storage NOI with expense floor enforcement (the critical test)
function storageNOI(grossDollarsIn, sellerStatedExpensePct) {
  const expenseRatio = Math.max(sellerStatedExpensePct || 0, STORAGE_EXPENSE_FLOOR);
  const expenses     = grossDollarsIn * expenseRatio;
  const noi          = grossDollarsIn - expenses;
  const floorBinds   = expenseRatio === STORAGE_EXPENSE_FLOOR;
  return { grossDollarsIn, sellerStatedExpensePct,
           appliedExpenseRatio: expenseRatio, expenses, noi, floorBinds };
}

// Storage Group A max purchase (bank financing, conservative DSCR)
function storageGroupA(noi) {
  const dsFactor         = LTV_STORAGE * K_BANK_STORAGE;
  const maxPurchase      = noi / (DSCR_CONSERVATIVE * dsFactor);
  const rounded          = Math.floor(maxPurchase / 1000) * 1000;
  const bankLoan         = rounded * LTV_STORAGE;
  const annualDS         = bankLoan * K_BANK_STORAGE;
  const actualDSCR       = noi / annualDS;
  return { noi, K: K_BANK_STORAGE, dsFactor, maxPurchase: rounded,
           yourOffer: rounded - WHOLESALE_FEE, bankLoan, annualDS, actualDSCR,
           dscrPass: actualDSCR >= DSCR_CONSERVATIVE, dscrTarget: DSCR_CONSERVATIVE };
}

// Residential MAO (Maximum Allowable Offer for flips)
function residentialMAO(arv, rehab) {
  const step1     = arv * MAO_FACTOR;
  const step2     = step1 - WHOLESALE_FEE;
  const maxOffer  = step2 - rehab;
  return { arv, maoFactor: MAO_FACTOR, step1, wholesaleFee: WHOLESALE_FEE,
           step2, rehab, maxOffer };
}

// Multifamily — TIERED per Math Bible v3.1 addendum (Steve-confirmed 2026-06-01).
//   1–19 units → agency-style 80/20 LTV @ 7% / 30-yr  (= residential bank terms)
//   20+ units  → commercial   75/25 LTV @ 7.25% / 25-yr (= storage bank terms)
// Same CANONICAL Group-A max-purchase formula  P_max = NOI / (DSCR × LTV × K);
// only the LTV + loan constant differ by tier. No new formula or new constant —
// it reuses K_BANK_RESI / K_BANK_STORAGE that already exist in the Bible.
function multifamilyTier(noi, ltv, K, tier, terms) {
  const dsFactor    = ltv * K;
  const maxPurchase = noi / (DSCR_CONSERVATIVE * dsFactor);
  const rounded     = Math.floor(maxPurchase / 1000) * 1000;
  const bankLoan    = rounded * ltv;
  const annualDS    = bankLoan * K;
  const actualDSCR  = annualDS > 0 ? noi / annualDS : 0;
  return { noi, tier, terms, ltv, K, dsFactor, maxPurchase: rounded,
           yourOffer: rounded - WHOLESALE_FEE, bankLoan, annualDS, actualDSCR,
           dscrPass: actualDSCR >= DSCR_CONSERVATIVE, dscrTarget: DSCR_CONSERVATIVE };
}
function multifamilySmall(noi) {
  return multifamilyTier(noi, LTV_RESI, K_BANK_RESI, '1-19 units',
    '80/20 LTV · 7% / 30-yr agency-style debt');
}
function multifamilyLarge(noi) {
  return multifamilyTier(noi, LTV_STORAGE, K_BANK_STORAGE, '20+ units',
    '75/25 LTV · 7.25% / 25-yr commercial debt');
}

// Residential DSCR check (for rental/hold)
function residentialDSCR(annualNOI, purchase) {
  const loan     = purchase * LTV_RESI;
  const dsFactor = LTV_RESI * K_BANK_RESI;
  const annualDS = loan * K_BANK_RESI;
  const dscr     = annualNOI / annualDS;
  const pass     = dscr >= DSCR_CONSERVATIVE;
  const pocket   = annualNOI - annualDS;
  return { annualNOI, purchase, loan, K: K_BANK_RESI, dsFactor,
           annualDS, dscr, pass, pocketCashAnnual: pocket,
           pocketCashMonthly: pocket / 12, pocketFloorBinds: pocket < POCKET_FLOOR,
           dscrTarget: DSCR_CONSERVATIVE };
}

// Commercial with dual DSCR scenarios (1.25 conservative, 1.15 stretch/ramp)
function commercialDSCR(noi) {
  const dsFactor = LTV_COMMERCIAL * K_BANK_COMMERCIAL;

  // Conservative scenario (1.25x DSCR)
  const maxPurchaseConservative = noi / (DSCR_CONSERVATIVE * dsFactor);
  const roundedConservative = Math.floor(maxPurchaseConservative / 1000) * 1000;
  const loanConservative = roundedConservative * LTV_COMMERCIAL;
  const annualDSConservative = loanConservative * K_BANK_COMMERCIAL;
  const dscrConservative = noi / annualDSConservative;

  // Stretch/Ramp scenario (1.15x DSCR)
  const maxPurchaseStretch = noi / (DSCR_STRETCH * dsFactor);
  const roundedStretch = Math.floor(maxPurchaseStretch / 1000) * 1000;
  const loanStretch = roundedStretch * LTV_COMMERCIAL;
  const annualDSStretch = loanStretch * K_BANK_COMMERCIAL;
  const dscrStretch = noi / annualDSStretch;

  return {
    noi, K: K_BANK_COMMERCIAL, dsFactor,
    conservative: {
      label: 'Conservative (1.25x DSCR)',
      dscr: dscrConservative,
      dscr_target: DSCR_CONSERVATIVE,
      pass: dscrConservative >= DSCR_CONSERVATIVE,
      maxPurchase: roundedConservative,
      loan: loanConservative,
      annualDS: annualDSConservative,
      yourOffer: roundedConservative - WHOLESALE_FEE
    },
    stretch: {
      label: 'Stretch / Ramp (1.15x DSCR)',
      dscr: dscrStretch,
      dscr_target: DSCR_STRETCH,
      pass: dscrStretch >= DSCR_STRETCH,
      maxPurchase: roundedStretch,
      loan: loanStretch,
      annualDS: annualDSStretch,
      yourOffer: roundedStretch - WHOLESALE_FEE
    }
  };
}

// MHP NOI
function mhpNOI(lots, lotRent, pohUnits, pohRent, expenseRatio) {
  const lotIncome = lots * lotRent * 12;
  const pohIncome = pohUnits * pohRent * 12;
  const gross     = lotIncome + pohIncome;
  const expenses  = gross * expenseRatio;
  const noi       = gross - expenses;
  const capRate   = (purchasePrice) => purchasePrice > 0 ? noi / purchasePrice : 0;
  return { lotIncome, pohIncome, gross, expenses, noi, expenseRatio, capRate };
}

// ── Handler ──
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  try {
    const { type, inputs = {} } = req.body || {};

    if (type === 'storage_noi') {
      const gross    = Number(inputs.grossDollarsIn        ?? 0);
      const expPct   = Number(inputs.sellerStatedExpensePct ?? 0);
      return res.json({ ok: true, type, result: storageNOI(gross, expPct) });
    }

    if (type === 'storage_group_a') {
      const noi = Number(inputs.noi ?? 0);
      return res.json({ ok: true, type, result: storageGroupA(noi) });
    }

    if (type === 'multifamily_small') {
      const noi = Number(inputs.noi ?? 0);
      return res.json({ ok: true, type, result: multifamilySmall(noi) });
    }

    if (type === 'multifamily_large') {
      const noi = Number(inputs.noi ?? 0);
      return res.json({ ok: true, type, result: multifamilyLarge(noi) });
    }

    if (type === 'residential_mao') {
      const arv   = Number(inputs.arv   ?? 0);
      const rehab = Number(inputs.rehab ?? 0);
      return res.json({ ok: true, type, result: residentialMAO(arv, rehab) });
    }

    if (type === 'residential_dscr') {
      const noi      = Number(inputs.annualNOI ?? 0);
      const purchase = Number(inputs.purchase  ?? 0);
      return res.json({ ok: true, type, result: residentialDSCR(noi, purchase) });
    }

    if (type === 'commercial_dscr') {
      const noi = Number(inputs.annualNOI ?? 0);
      return res.json({ ok: true, type, result: commercialDSCR(noi) });
    }

    if (type === 'mhp_noi') {
      const { lots=0, lotRent=0, pohUnits=0, pohRent=0, expenseRatio=0.45 } = inputs;
      return res.json({ ok: true, type, result: mhpNOI(
        Number(lots), Number(lotRent), Number(pohUnits), Number(pohRent), Number(expenseRatio)
      )});
    }

    if (type === 'constants') {
      return res.json({ ok: true, type, result: {
        STORAGE_EXPENSE_FLOOR, LTV_STORAGE, LTV_RESI, LTV_COMMERCIAL,
        RATE_BANK_STORAGE, AMORT_BANK_STORAGE, K_BANK_STORAGE,
        RATE_BANK_RESI, AMORT_BANK_RESI, K_BANK_RESI,
        RATE_BANK_COMMERCIAL, AMORT_BANK_COMMERCIAL, K_BANK_COMMERCIAL,
        DSCR_CONSERVATIVE, DSCR_STRETCH, MAO_FACTOR, WHOLESALE_FEE, POCKET_FLOOR
      }});
    }

    if (type === 'standards') {
      const assetType = inputs.asset_type || 'commercial';
      if (assetType === 'commercial') {
        return res.json({ ok: true, type, assetClass: 'commercial', assumptions: {
          rate: RATE_BANK_COMMERCIAL,
          amort: AMORT_BANK_COMMERCIAL,
          ltv: LTV_COMMERCIAL,
          dscrConservative: DSCR_CONSERVATIVE,
          dscrStretch: DSCR_STRETCH
        }});
      } else if (assetType === 'storage') {
        return res.json({ ok: true, type, assetClass: 'storage', assumptions: {
          rate: RATE_BANK_STORAGE,
          amort: AMORT_BANK_STORAGE,
          ltv: LTV_STORAGE,
          expenseFloor: STORAGE_EXPENSE_FLOOR,
          dscrConservative: DSCR_CONSERVATIVE,
          dscrStretch: DSCR_STRETCH
        }});
      }
      return res.status(400).json({ error: `Unknown asset_type: ${assetType}` });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
