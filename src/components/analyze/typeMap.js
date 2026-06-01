// src/components/analyze/typeMap.js
//
// The single source of truth mapping each supported property type to:
//   - its question set (vertical-stacked fields)
//   - which existing bible-math /api/calc engine analyzes it (NO new math)
//   - how to build the /api/calc payload from the collected fields
//   - whether an analysis engine exists yet
//
// Engine routing per Steve's directive:
//   Residential          → residential_mao (flip) / residential_dscr (rental)
//   Self Storage         → storage_group_a
//   Multifamily 1-19     → multifamily_small  (agency 80/20 @ 7%/30yr — Bible v3.1 tier)
//   Multifamily 20+      → multifamily_large  (commercial 75/25 @ 7.25%/25yr — Bible v3.1 tier)
//   Commercial           → commercial_dscr   (Retail / Office / Warehouse)
//   MHP / RV Park        → mhp_noi → storage_group_a
//   Mixed Use            → commercial_dscr on blended NOI
//   IOS / Land           → storage_group_a IF income present; else INTAKE-ONLY.
//                          Full land/IOS underwriting lives in the dedicated Land / IOS tab.
//
// Multifamily tiers reuse EXISTING frozen engines with Bible-confirmed constants
// (no new math): 1-19 uses residential bank terms, 20+ uses storage bank terms.
//
// Lending is intentionally excluded from Baby Analyzer.

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// NOI from an explicit NOI field, else Gross − Expenses($), else Gross × (1 − ratio%).
// The ratio is a whole percent (41 → 0.41); an out-of-range value (e.g. 41000,
// a fat-finger of dollars into the % field) is treated as unset so NOI can never
// go negative from a typo.
function deriveNOI(f) {
  if (num(f.noi) > 0) return num(f.noi);
  const gross = num(f.grossIncome);
  if (gross > 0) {
    const expD = num(f.expenses);
    if (expD > 0) return Math.max(0, Math.round(gross - expD));
    let er = (f.expenseRatio !== '' && f.expenseRatio != null) ? num(f.expenseRatio) / 100 : 0.4;
    if (!(er >= 0) || er > 1) er = 0.4;                 // sanitize out-of-range %
    return Math.round(gross * (1 - er));
  }
  return 0;
}

const INCOME_FIELDS = [
  { key: 'askingPrice', label: 'Seller Asking Price ($)', type: 'money' },
  { key: 'noi', label: 'Net Operating Income — NOI ($/yr)', type: 'money', hint: 'If blank, Baby Analyzer computes NOI from Gross minus Expenses (or the ratio) below.' },
  { key: 'grossIncome', label: 'Gross Income ($/yr)', type: 'money' },
  { key: 'expenses', label: 'Annual Operating Expenses ($/yr)', type: 'money', hint: 'Enter actual dollars. If set, NOI = Gross − Expenses (storage enforces a 35% expense floor).' },
  { key: 'expenseRatio', label: 'Operating Expense Ratio (%)', type: 'number', hint: 'Alternative to dollars. A PERCENT like 41 (not 41000). Defaults to 40% if blank or out of range.' }
];

export const PROPERTY_TYPES = [
  {
    id: 'residential',
    label: 'Residential (SFR / 2–4 units)',
    enrichAssetType: 'residential',
    implemented: true,
    subModes: [
      { id: 'flip', label: 'Flip (MAO)' },
      { id: 'rental', label: 'Rental (DSCR)' }
    ],
    fields: [
      { key: 'askingPrice', label: 'Seller Asking Price ($)', type: 'money' },
      { key: 'arv', label: 'After-Repair Value — ARV ($)', type: 'money', modes: ['flip'] },
      { key: 'rehab', label: 'Rehab Budget ($)', type: 'money', modes: ['flip'] },
      { key: 'noi', label: 'Net Operating Income — NOI ($/yr)', type: 'money', modes: ['rental'] },
      { key: 'purchase', label: 'Purchase Price for DSCR ($)', type: 'money', modes: ['rental'], hint: 'Defaults to asking price if blank.' },
      { key: 'beds', label: 'Beds', type: 'number' },
      { key: 'baths', label: 'Baths', type: 'number' },
      { key: 'sqft', label: 'Square Feet', type: 'number' }
    ],
    buildCalc: (f, mode) => {
      if (mode === 'rental') {
        const noi = num(f.noi);
        const purchase = num(f.purchase) || num(f.askingPrice);
        if (noi <= 0 || purchase <= 0) return null;
        return { type: 'residential_dscr', inputs: { annualNOI: noi, purchase } };
      }
      const arv = num(f.arv);
      const rehab = num(f.rehab);
      if (arv <= 0) return null;
      return { type: 'residential_mao', inputs: { arv, rehab } };
    }
  },
  {
    id: 'self_storage',
    label: 'Self Storage',
    enrichAssetType: 'storage',
    implemented: true,
    fields: INCOME_FIELDS,
    buildCalc: (f) => { const noi = deriveNOI(f); return noi > 0 ? { type: 'storage_group_a', inputs: { noi } } : null; }
  },
  {
    id: 'multifamily_small',
    label: 'Multifamily — 1–19 units',
    enrichAssetType: 'multifamily',
    implemented: true,
    note: 'Agency-style financing: 80/20 LTV @ 7% / 30-yr (Math Bible v3.1 small-MF tier). NOI → 1.25 DSCR → max purchase. Reuses the residential bank engine — not a new engine.',
    fields: [
      ...INCOME_FIELDS,
      { key: 'units', label: 'Number of Units (1–19)', type: 'number' }
    ],
    buildCalc: (f) => { const noi = deriveNOI(f); return noi > 0 ? { type: 'multifamily_small', inputs: { noi } } : null; }
  },
  {
    id: 'multifamily_large',
    label: 'Multifamily — 20+ units',
    enrichAssetType: 'multifamily',
    implemented: true,
    note: 'Storage / commercial income-property framework: 75/25 LTV @ 7.25% / 25-yr (Math Bible v3.1 large-MF tier). Routes through the income scenario matrix (Group A/B/C bank + seller-finance), identical capital stack to Storage Group A.',
    fields: [
      ...INCOME_FIELDS,
      { key: 'units', label: 'Number of Units (20+)', type: 'number' }
    ],
    // Income-matrix asset (isIncomeAsset) — the matrix renders it. buildCalc is a
    // single-offer fallback (same number) kept for the /api/calc regression harness.
    buildCalc: (f) => { const noi = deriveNOI(f); return noi > 0 ? { type: 'multifamily_large', inputs: { noi } } : null; }
  },
  {
    id: 'commercial',
    label: 'Commercial (Retail / Office / Warehouse)',
    enrichAssetType: 'commercial',
    implemented: true,
    subModes: [
      { id: 'retail', label: 'Retail' },
      { id: 'office', label: 'Office' },
      { id: 'warehouse', label: 'Warehouse' }
    ],
    fields: [
      ...INCOME_FIELDS,
      { key: 'sqft', label: 'Building Square Feet', type: 'number' }
    ],
    buildCalc: (f) => { const noi = deriveNOI(f); return noi > 0 ? { type: 'commercial_dscr', inputs: { annualNOI: noi } } : null; }
  },
  {
    id: 'mhp_rv',
    label: 'Mobile Home Park / RV Park',
    enrichAssetType: 'mhp',
    implemented: true,
    fields: [
      { key: 'askingPrice', label: 'Seller Asking Price ($)', type: 'money' },
      { key: 'lots', label: 'Total Lots', type: 'number' },
      { key: 'lotRent', label: 'Lot Rent ($/lot/month)', type: 'money' },
      { key: 'pohUnits', label: 'Park-Owned Homes (count)', type: 'number' },
      { key: 'pohRent', label: 'POH Rent ($/unit/month)', type: 'money' },
      { key: 'expenseRatio', label: 'Operating Expense Ratio (%)', type: 'number', hint: 'Defaults to 40% if blank.' }
    ],
    // MHP is two-step: mhp_noi → storage_group_a on the resulting NOI.
    buildCalc: (f) => {
      const lots = num(f.lots);
      if (lots <= 0) return null;
      return {
        type: 'mhp_noi',
        inputs: {
          lots,
          lotRent: num(f.lotRent),
          pohUnits: num(f.pohUnits),
          pohRent: num(f.pohRent),
          expenseRatio: f.expenseRatio !== '' && f.expenseRatio != null ? num(f.expenseRatio) / 100 : 0.4
        },
        chainToStorage: true
      };
    }
  },
  {
    id: 'mixed_use',
    label: 'Mixed Use',
    enrichAssetType: 'commercial',
    implemented: true,
    note: 'Headline uses blended NOI through the commercial engine. Use the Mixed Use tab for full per-component blending.',
    fields: INCOME_FIELDS,
    buildCalc: (f) => { const noi = deriveNOI(f); return noi > 0 ? { type: 'commercial_dscr', inputs: { annualNOI: noi } } : null; }
  },
  {
    id: 'ios_land',
    label: 'Land / IOS / Outdoor Storage → open the “Land / IOS” tab',
    enrichAssetType: 'land',
    implemented: false, // no approved land OFFER engine exists — land uses supported-intake
    note: 'Land / IOS / outdoor storage uses LAND supported-intake logic. Open the dedicated “Land / IOS” tab for the full facts + zoning + unit-price metrics + risk + LOI report. Land is NEVER routed through storage, residential, multifamily, or commercial building math.',
    fields: [
      { key: 'askingPrice', label: 'Seller Asking Price ($)', type: 'money' },
      { key: 'acres', label: 'Acres', type: 'number' }
    ],
    // Land has NO offer engine here — never borrow storage/other math, even with income.
    buildCalc: () => null
  }
];

export function getType(id) {
  return PROPERTY_TYPES.find((t) => t.id === id) || null;
}

export { num, deriveNOI };
