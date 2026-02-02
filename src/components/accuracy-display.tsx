"use client"

import * as React from "react"
import Link from "next/link"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AccuracyDisplayProps {
  correct: number
  total: number
  showBar?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
}

export function AccuracyDisplay({
  correct,
  total,
  showBar = false,
  size = "md",
  className,
}: AccuracyDisplayProps) {
  const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 cursor-help",
              sizeClasses[size]
            )}
          >
            <span className="font-mono">
              {correct}/{total}
            </span>
            <span className="text-muted-foreground">({accuracy}%)</span>
            <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex flex-col gap-2">
            <p className="font-bold">Tendency Accuracy</p>
            <p className="text-xs">
              {correct} correct predictions out of {total} scored matches.
            </p>
            <Link
              href="/methodology"
              className="text-primary hover:underline text-xs"
            >
              Learn how we calculate accuracy
            </Link>
          </div>
        </TooltipContent>
      </Tooltip>

      {showBar && total > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${accuracy}%` }}
          />
        </div>
      )}
    </div>
  )
}
