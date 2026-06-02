import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '../App.jsx'

// New single-path UI contract (2026-06-02): the top navigation exposes ONLY
// "Analyze a Deal" and "QA Runner". Property type is chosen from a dropdown
// inside Analyze a Deal; each deep underwriter (Storage / Residential / MHP /
// Commercial / Mixed Use / Land) mounts inline under "Full Analysis" mode.
describe('App skeleton — one analyzer path', () => {
  it('renders the title and version', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'REI Baby Analyzer' })).toBeInTheDocument()
    expect(screen.getByText(/Operator-grade pre-LOI deal analysis/i)).toBeInTheDocument()
  })

  it('top nav has ONLY Analyze a Deal + QA Runner (no per-type tabs)', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Analyze a Deal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'QA Runner' })).toBeInTheDocument()
    // The old per-type top tabs must be gone from the nav.
    expect(screen.queryByRole('button', { name: 'Storage' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Residential' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'MHP' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mixed Use' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quick Analysis' })).not.toBeInTheDocument()
  })

  it('shows the Analyze a Deal workspace with the property-type dropdown by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Property Type/i })).toBeInTheDocument()
    // Default type is Residential and default mode is Full Analysis → the deep
    // Residential underwriter mounts inline (its own "Residential" heading).
    expect(screen.getByRole('heading', { name: 'Residential' })).toBeInTheDocument()
    // Mode toggle is present.
    expect(screen.getByRole('button', { name: /Full Analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /FastCalc/i })).toBeInTheDocument()
  })

  it('switching to FastCalc shows the document/photo upload path', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /FastCalc/i }))
    expect(screen.getByRole('heading', { name: /Upload Documents & Photos/i })).toBeInTheDocument()
  })

  it('choosing Self Storage in the dropdown mounts the deep Storage underwriter', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'self_storage')
    // Full Analysis is the default → deep Storage tool renders inline.
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument()
  })

  it('shows the engine status line for confidence/debugging', () => {
    render(<App />)
    expect(screen.getByText(/Engine status/i)).toBeInTheDocument()
    // "App v0.7.0" appears only in the status line (footer says "Math Bible v3.1").
    expect(screen.getByText(/App v0\.7\.0/i)).toBeInTheDocument()
  })

  it('QA Runner tab loads without crashing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'QA Runner' }))
    expect(screen.getByRole('heading', { name: /Baby Analyzer QA Runner/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run all QA tests/i })).toBeInTheDocument()
  })

  it('Land / IOS is reachable from the dropdown (deep intake mounts inline)', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'ios_land')
    expect(screen.getByRole('heading', { name: /Land \/ IOS \/ Outdoor Storage/i })).toBeInTheDocument()
  })
})
