import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PostDraft } from '../PostDraft'
import '@testing-library/jest-dom'

// Mock the PostDraft component props
const mockDraft = {
  text: 'これはテストツイートです #テスト',
  naturalnessScore: 85,
  hashtags: ['テスト'],
  formatType: '見出し型',
}

const mockOnApprove = jest.fn()
const mockOnSchedule = jest.fn()

describe('PostDraft Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders draft text correctly', () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    expect(screen.getByText('これはテストツイートです #テスト')).toBeInTheDocument()
  })

  it('displays naturalness score', () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    expect(screen.getByText(/85\/100/)).toBeInTheDocument()
  })

  it('displays hashtags', () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    expect(screen.getByText('#テスト')).toBeInTheDocument()
  })

  it('calls onApprove when approve button is clicked', async () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const approveButton = screen.getByText(/承認して投稿/)
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(mockOnApprove).toHaveBeenCalledWith(mockDraft)
    })
  })

  it('disables approve button when posting', () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={true}
      />
    )

    const approveButton = screen.getByText(/投稿中/)
    expect(approveButton).toBeDisabled()
  })

  it('shows schedule form when schedule button is clicked', () => {
    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const scheduleButton = screen.getByText(/スケジュール/)
    fireEvent.click(scheduleButton)

    expect(screen.getByText(/スケジュール設定/)).toBeInTheDocument()
  })

  it('copies text to clipboard when copy button is clicked', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    render(
      <PostDraft
        draft={mockDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const copyButton = screen.getByText(/コピー/)
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDraft.text)
      expect(screen.getByText(/コピー済み/)).toBeInTheDocument()
    })
  })

  it('displays correct score color for high score', () => {
    const highScoreDraft = { ...mockDraft, naturalnessScore: 90 }
    render(
      <PostDraft
        draft={highScoreDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const scoreElement = screen.getByText(/90\/100/)
    expect(scoreElement).toHaveClass('text-green-600')
  })

  it('displays correct score color for medium score', () => {
    const mediumScoreDraft = { ...mockDraft, naturalnessScore: 60 }
    render(
      <PostDraft
        draft={mediumScoreDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const scoreElement = screen.getByText(/60\/100/)
    expect(scoreElement).toHaveClass('text-yellow-600')
  })

  it('displays correct score color for low score', () => {
    const lowScoreDraft = { ...mockDraft, naturalnessScore: 30 }
    render(
      <PostDraft
        draft={lowScoreDraft}
        index={0}
        onApprove={mockOnApprove}
        onSchedule={mockOnSchedule}
        isPosting={false}
      />
    )

    const scoreElement = screen.getByText(/30\/100/)
    expect(scoreElement).toHaveClass('text-red-600')
  })
})
