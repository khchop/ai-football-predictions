import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const matchBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      outcome: {
        win: "bg-win/10 text-win border-win/20 dark:bg-win/20",
        draw: "bg-draw/10 text-draw border-draw/20 dark:bg-draw/20",
        loss: "bg-loss/10 text-loss border-loss/20 dark:bg-loss/20",
        none: "bg-muted text-muted-foreground border-border",
      },
      status: {
        live: "bg-destructive text-white border-destructive animate-pulse",
        upcoming: "bg-primary/10 text-primary border-primary/20",
        finished: "bg-muted text-muted-foreground border-border",
        postponed: "bg-muted text-muted-foreground border-border italic",
        cancelled: "bg-destructive/10 text-destructive border-destructive/20 line-through",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface MatchBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof matchBadgeVariants> {}

function MatchBadge({
  className,
  outcome,
  status,
  size,
  ...props
}: MatchBadgeProps) {
  return (
    <span
      className={cn(matchBadgeVariants({ outcome, status, size }), className)}
      {...props}
    />
  )
}

export { MatchBadge, matchBadgeVariants }
