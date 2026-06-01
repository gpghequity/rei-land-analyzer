// src/math/land.js
//
// LAND / IOS / OUTDOOR STORAGE — deterministic valuation METRICS only.
//
// IMPORTANT (Math Bible v3.1 land policy): there is NO approved Math Bible land
// OFFER engine. This module therefore computes ONLY factual unit-price ratios and
// (when ACTUAL current income exists) standard income ratios. It NEVER produces a
// recommended offer, MAO, or supportable price — that requires manual underwriting.
//
// Nothing here routes land through residential ARV, storage, MHP, or commercial
// building math. Residential AVM is never treated as land value (the UI labels any
// AVM "reference only"). These are arithmetic ratios on operator-/document-entered
// facts — not an underwriting model.

const SQFT_PER_ACRE = 43560;

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Divide that returns null (not 0 or Infinity) when the denominator is missing,
// so the UI shows "—" instead of a misleading number.
function ratio(numerator, denominator) {
  const a = num(numerator);
  const b = num(denominator);
  if (b <= 0 || a <= 0) return null;
  return a / b;
}

// Compute every land metric the Bible's "Valuation Metrics" section lists.
// All optional — each returns null when its inputs are absent.
export function landMetrics(input = {}) {
  const asking = num(input.askingPrice);
  const acres = num(input.acres);
  // Derive square footage from acres when not explicitly provided.
  const lotSqft = num(input.lotSqft) > 0 ? num(input.lotSqft) : (acres > 0 ? acres * SQFT_PER_ACRE : 0);
  const usableAcres = num(input.usableAcres) > 0 ? num(input.usableAcres) : 0;

  // Current income is ONLY real, in-place income (ground lease / IOS rent / yard
  // rent). Pro-forma is never used (Bible: pro-forma = SELLER FICTION).
  const currentIncome = num(input.currentIncome);
  const currentNOI = num(input.currentNOI) > 0 ? num(input.currentNOI) : 0;

  return {
    askingPrice: asking || null,
    acres: acres || null,
    lotSqft: lotSqft || null,
    usableAcres: usableAcres || null,

    pricePerAcre: ratio(asking, acres),
    pricePerSqft: ratio(asking, lotSqft),
    pricePerUsableAcre: ratio(asking, usableAcres),
    pricePerBuildableLot: ratio(asking, input.buildableLots),
    pricePerApprovedUnit: ratio(asking, input.approvedUnits),
    pricePerTruckSpace: ratio(asking, input.truckSpaces),
    pricePerOutdoorStorageAcre: ratio(asking, input.outdoorStorageAcres),

    // Income ratios ONLY when actual current income exists. Clearly flagged so the
    // UI can label them "income-based estimate only — not a land valuation engine".
    hasCurrentIncome: currentIncome > 0 || currentNOI > 0,
    currentIncomeMultiple: ratio(asking, currentIncome),       // asking ÷ gross income
    capRateIfIncome: currentNOI > 0 && asking > 0 ? currentNOI / asking : null
  };
}

export { num as _num, SQFT_PER_ACRE };
