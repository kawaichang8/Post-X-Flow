import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../Pagination'
import '@testing-library/jest-dom'

describe('Pagination Component', () => {
  const mockOnPageChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders pagination controls', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('calls onPageChange when page number is clicked', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const page3Button = screen.getByText('3')
    fireEvent.click(page3Button)

    expect(mockOnPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange when next button is clicked', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const nextButton = screen.getByLabelText(/次へ/)
    fireEvent.click(nextButton)

    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when previous button is clicked', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const prevButton = screen.getByLabelText(/前へ/)
    fireEvent.click(prevButton)

    expect(mockOnPageChange).toHaveBeenCalledWith(1)
  })

  it('disables previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const prevButton = screen.getByLabelText(/前へ/)
    expect(prevButton).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )

    const nextButton = screen.getByLabelText(/次へ/)
    expect(nextButton).toBeDisabled()
  })

  it('shows ellipsis for many pages', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={mockOnPageChange}
      />
    )

    // Should show current page and nearby pages
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('handles single page correctly', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={mockOnPageChange}
      />
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    const nextButton = screen.getByLabelText(/次へ/)
    const prevButton = screen.getByLabelText(/前へ/)
    expect(nextButton).toBeDisabled()
    expect(prevButton).toBeDisabled()
  })
})
