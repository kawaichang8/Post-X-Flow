import { render, screen } from '@testing-library/react'
import { ProgressBar, LoadingSpinner, LoadingOverlay } from '../ProgressBar'
import '@testing-library/jest-dom'

describe('ProgressBar Component', () => {
  it('renders progress bar with correct value', () => {
    render(<ProgressBar value={50} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('displays percentage text', () => {
    render(<ProgressBar value={75} />)
    
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('handles 0% correctly', () => {
    render(<ProgressBar value={0} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('handles 100% correctly', () => {
    render(<ProgressBar value={100} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps value to 0-100 range', () => {
    const { rerender } = render(<ProgressBar value={150} />)
    let progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')

    rerender(<ProgressBar value={-10} />)
    progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('LoadingSpinner Component', () => {
  it('renders spinner', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status')
    expect(spinner).toBeInTheDocument()
  })

  it('displays custom message', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status')
    expect(spinner).toBeInTheDocument()
  })
})

describe('LoadingOverlay Component', () => {
  it('renders overlay with message', () => {
    render(<LoadingOverlay isLoading={true} message="処理中..." />)
    
    expect(screen.getByText('処理中...')).toBeInTheDocument()
  })

  it('renders overlay with progress', () => {
    render(<LoadingOverlay isLoading={true} message="生成中..." progress={50} />)
    
    expect(screen.getByText('生成中...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('hides progress when not provided', () => {
    render(<LoadingOverlay isLoading={true} message="読み込み中..." />)
    
    const progressBars = screen.queryAllByRole('progressbar')
    expect(progressBars).toHaveLength(0)
  })

  it('does not render when isLoading is false', () => {
    render(<LoadingOverlay isLoading={false} message="処理中..." />)
    
    expect(screen.queryByText('処理中...')).not.toBeInTheDocument()
  })
})
