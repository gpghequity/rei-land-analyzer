import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '../App.jsx'

describe('App skeleton', () => {
  it('renders the title and version', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'REI Baby Analyzer' })).toBeInTheDocument()
    expect(screen.getByText(/Operator-grade pre-LOI deal analysis/i)).toBeInTheDocument()
  })

  it('renders all four tab buttons', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Storage' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Residential' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'MHP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commercial' })).toBeInTheDocument()
  })

  it('shows Storage tab content by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument()
  })

  it('switches to Residential when clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Residential' }))
    expect(screen.getByRole('heading', { name: 'Residential' })).toBeInTheDocument()
  })

  it('switches to Commercial and shows the live commercial/NNN UI', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Commercial' }))
    expect(screen.getByRole('heading', { name: /Commercial/i })).toBeInTheDocument()
    expect(screen.getByText(/DSCR/i)).toBeInTheDocument()
  })
})
