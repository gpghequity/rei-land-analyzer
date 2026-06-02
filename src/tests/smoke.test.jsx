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

  it('defaults to the FULL Baby Analyzer screen: questions + document/photo upload', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Property Type/i })).toBeInTheDocument()
    // Default = the full standard screen — deal info + document/photo upload are present.
    expect(screen.getByRole('heading', { name: /Deal Information/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Upload Documents & Photos/i })).toBeInTheDocument()
    // The deep manual underwriter is NOT shown by default.
    expect(screen.queryByRole('heading', { name: 'Residential' })).not.toBeInTheDocument()
    // Depth toggle is present (full default + optional deep).
    expect(screen.getByRole('button', { name: /Full Analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Deep Residential underwriter/i })).toBeInTheDocument()
  })

  it('opting into the deep underwriter mounts it inline (and hides the standard upload)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Deep Residential underwriter/i }))
    expect(screen.getByRole('heading', { name: 'Residential' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Upload Documents & Photos/i })).not.toBeInTheDocument()
  })

  it('Self Storage keeps the full upload screen by default; deep is one opt-in click', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'self_storage')
    // Default stays on the full screen — documents/photos still accepted.
    expect(screen.getByRole('heading', { name: /Upload Documents & Photos/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Deep Self Storage underwriter/i }))
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument()
  })

  it('shows the engine status line for confidence/debugging', () => {
    render(<App />)
    expect(screen.getByText(/Engine status/i)).toBeInTheDocument()
    // "App v0.7.1" appears only in the status line (footer says "Math Bible v3.1").
    expect(screen.getByText(/App v0\.7\.1/i)).toBeInTheDocument()
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
