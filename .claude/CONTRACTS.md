# Baby Analyzer Integration Contracts

## Receive postMessage from Rehab Calc (Embed Mode)

**From:** `rei-rehab-calc.vercel.app` (when embedded with `?embed=1`)  
**Handler:** RehabEmbed component, line ~339  
**Usage:** Capture rehab calculation and feed into offer math  

### Expected Message Format (v1)

```javascript
{
  type: 'rei-rehab-total',
  version: 1,
  timestamp: Date.now(),
  mode: 'residential' | 'storage',
  totalRehab: number,      // Finite number, required
  grandTotal: number,      // Finite number, required
  holdingCost: number,     // Optional (defaults to 0)
  lineItems: [             // Optional array
    { id, label, condition, total, breakdown }
    // breakdown: e.g. "1,600 sqft × $9.38 × 80% = $15,000"
  ],
  sqft: number,            // Optional
  address: string          // Optional
}
```

### Critical Rules

1. **ALWAYS check version FIRST** — if `version !== 1`, warn and ignore
2. **NEVER assume fields exist** — use defensive defaults (holdingCost || 0)
3. **ALWAYS validate numbers are finite** before using in math
4. **NEVER throw on bad message** — swallow errors, log them, continue analyzing
5. **IF REHAB CALC SENDS v2+** → This code ignores it (doesn't crash), team must coordinate update

### Where This is Used

- File: `src/components/AnalyzeDealTab.jsx`, RehabEmbed useEffect, line ~339
- Usage: Calls `onResult(totalRehab, details)` which updates local state
- Math Integration: `setRehabCondition(total)` feeds into offer calculation

### Safe Message Handler

```javascript
function onMsg(e) {
  const d = e.data;
  if (!d || d.type !== 'rei-rehab-total') return;
  
  try {
    if (d.version !== 1) {
      console.warn('Unknown message version:', d.version);
      return; // Ignore future versions gracefully
    }
    
    // Type guards on every field
    const totalRehab = d.totalRehab;
    const grandTotal = d.grandTotal;
    
    if (typeof totalRehab !== 'number' || !Number.isFinite(totalRehab)) {
      console.error('Invalid totalRehab:', totalRehab);
      return;
    }
    
    // Use the data safely
    onResult?.(totalRehab, { ... });
  } catch (err) {
    console.error('Message handler error:', err);
    // Don't throw — let UI continue
  }
}
```

### Backwards Compatibility

- v0 (old Rehab Calc, no version field): Ignored silently
- v1 (current): Accepted and used ← YOU ARE HERE
- v2+ (future): Warned and ignored (code stays safe)

**When Rehab Calc ships v2:** You MUST update this handler BEFORE it goes live.

### Test This

Run integration tester:
```bash
curl -X POST http://localhost:3000/run/rehab-calc-baby-analyzer
```

Should pass: "Baby Analyzer listener accepts v1 message"
