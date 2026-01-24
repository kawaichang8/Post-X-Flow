"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  total?: number
  className?: string
  showPageNumbers?: boolean
  maxPageNumbers?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  total,
  className,
  showPageNumbers = true,
  maxPageNumbers = 5,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const half = Math.floor(maxPageNumbers / 2)
    
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, currentPage + half)
    
    // Adjust if we're near the start or end
    if (end - start < maxPageNumbers - 1) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxPageNumbers - 1)
      } else {
        start = Math.max(1, end - maxPageNumbers + 1)
      }
    }
    
    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('...')
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }
    
    return pages
  }

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4", className)}>
      {/* Page Info */}
      {total !== undefined && pageSize && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {((currentPage - 1) * pageSize + 1)}-{Math.min(currentPage * pageSize, total)} / {total}件
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="rounded-full"
          aria-label="最初のページ"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-full"
          aria-label="前のページ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page Numbers */}
        {showPageNumbers && (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                    ...
                  </span>
                )
              }
              
              const pageNum = page as number
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "rounded-full min-w-[2.5rem]",
                    currentPage === pageNum && "bg-blue-500 hover:bg-blue-600 text-white"
                  )}
                  aria-label={`ページ ${pageNum}`}
                  aria-current={currentPage === pageNum ? "page" : undefined}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
        )}

        {/* Next Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-full"
          aria-label="次のページ"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="rounded-full"
          aria-label="最後のページ"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
