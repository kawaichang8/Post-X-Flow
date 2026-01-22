"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerSingleProps } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = Omit<DayPickerSingleProps, "selected" | "onSelect" | "mode"> & {
  mode?: "single"
  scheduledDates?: Date[]
  onDateClick?: (date: Date) => void
  selectedDate?: Date
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
  classNames?: Partial<{
    months: string
    month: string
    caption: string
    caption_label: string
    nav: string
    nav_button: string
    nav_button_previous: string
    nav_button_next: string
    table: string
    head_row: string
    head_cell: string
    row: string
    cell: string
    day: string
    day_range_end: string
    day_selected: string
    day_today: string
    day_outside: string
    day_disabled: string
    day_range_middle: string
    day_hidden: string
  }>
  showOutsideDays?: boolean
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  scheduledDates = [],
  onDateClick,
  selectedDate,
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  // Use selected prop if provided, otherwise use selectedDate
  const currentSelected = selected !== undefined ? selected : selectedDate

  const isScheduled = (date: Date) => {
    return scheduledDates.some(scheduled => {
      const scheduledDate = new Date(scheduled)
      return (
        scheduledDate.getFullYear() === date.getFullYear() &&
        scheduledDate.getMonth() === date.getMonth() &&
        scheduledDate.getDate() === date.getDate()
      )
    })
  }

  return (
    <DayPicker
      mode="single"
      selected={currentSelected}
      onSelect={(date) => {
        if (onSelect) {
          onSelect(date)
        }
        if (onDateClick && date) {
          onDateClick(date)
        }
      }}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-base font-semibold text-gray-900 dark:text-white",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mb-2",
        head_cell:
          "text-gray-500 dark:text-gray-400 rounded-md w-10 h-10 font-medium text-xs text-center flex items-center justify-center",
        row: "flex w-full mb-1",
        cell: "h-10 w-10 text-center text-sm p-0 relative flex items-center justify-center",
        day: cn(
          "h-10 w-10 rounded-full font-medium text-sm transition-all duration-200 hover:scale-110",
          "flex items-center justify-center relative"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold shadow-md scale-110",
        day_today: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold border-2 border-blue-500 dark:border-blue-400",
        day_outside:
          "text-gray-300 dark:text-gray-600 opacity-40",
        day_disabled: "text-gray-200 dark:text-gray-700 opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        DayButton: ({ day, modifiers, ...buttonProps }) => {
          const dayDate = day.date
          if (!dayDate || isNaN(dayDate.getTime())) {
            return <button {...buttonProps} type="button" className="h-10 w-10" />
          }
          
          const hasSchedule = isScheduled(dayDate)
          const isSelected = currentSelected && 
            dayDate.getFullYear() === currentSelected.getFullYear() &&
            dayDate.getMonth() === currentSelected.getMonth() &&
            dayDate.getDate() === currentSelected.getDate()
          
          return (
            <button
              {...buttonProps}
              type="button"
              className={cn(
                "relative h-10 w-10 rounded-full font-medium text-sm transition-all duration-200",
                "flex items-center justify-center",
                "hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-110",
                isSelected && "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold shadow-md scale-110",
                !isSelected && !modifiers.selected && !modifiers.today && "text-gray-700 dark:text-gray-300",
                modifiers.selected && !isSelected && "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white",
                modifiers.today && !isSelected && "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold border-2 border-blue-500 dark:border-blue-400",
                modifiers.outside && "text-gray-300 dark:text-gray-600 opacity-40"
              )}
            >
              <span className="relative z-10">{dayDate.getDate()}</span>
              {hasSchedule && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full z-20" />
              )}
              {hasSchedule && isSelected && (
                <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white dark:bg-gray-900 rounded-full z-20" />
              )}
            </button>
          )
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
