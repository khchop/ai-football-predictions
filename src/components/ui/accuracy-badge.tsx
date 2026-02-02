import * as React from "react"
import { cn } from "@/lib/utils"

export interface AccuracyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Accuracy percentage (0-100) */
  percentage: number
  /** Show percentage sign */
  showPercent?: boolean
  /** Number of decimal places */
  decimals?: number
}

/**
 * Displays accuracy percentage with gradient color coding.
 *
 * Color thresholds:
 * - < 40%: Red (low accuracy)
 * - 40-70%: Amber (mid accuracy)
 * - > 70%: Green (high accuracy)
 */
function AccuracyBadge({
  percentage,
  showPercent = true,
  decimals = 1,
  className,
  ...props
}: AccuracyBadgeProps) {
  // Determine color class based on percentage thresholds
  const getColorClasses = (pct: number): string => {
    if (pct < 40) {
      return "text-loss bg-loss/10 border-loss/20"
    }
    if (pct < 70) {
      return "text-draw bg-draw/10 border-draw/20"
    }
    return "text-win bg-win/10 border-win/20"
  }

  const formattedValue = percentage.toFixed(decimals)
  const displayValue = showPercent ? `${formattedValue}%` : formattedValue

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium border tabular-nums",
        getColorClasses(percentage),
        className
      )}
      {...props}
    >
      {displayValue}
    </span>
  )
}

export { AccuracyBadge }
