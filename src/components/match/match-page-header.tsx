'use client'

import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { MatchHeader } from './match-header'
import { MatchHeaderSticky } from './match-header-sticky'
import type { Match, Competition } from '@/lib/db/schema'

interface MatchPageHeaderProps {
  match: Match
  competition: Competition
  isLive: boolean
  isFinished: boolean
}

export function MatchPageHeader({ match, competition, isLive, isFinished }: MatchPageHeaderProps) {
  const { ref, isIntersecting } = useIntersectionObserver()

  return (
    <>
      <div ref={ref as React.RefObject<HTMLDivElement>}>
        <MatchHeader match={match} competition={competition} isLive={isLive} isFinished={isFinished} />
      </div>
      {!isIntersecting && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <MatchHeaderSticky match={match} competition={competition} isLive={isLive} isFinished={isFinished} />
        </div>
      )}
    </>
  )
}
