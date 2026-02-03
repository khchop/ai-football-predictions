import { MatchHeader } from './match-header'
import type { Match, Competition } from '@/lib/db/schema'

interface MatchPageHeaderProps {
  match: Match
  competition: Competition
  isLive: boolean
  isFinished: boolean
}

export function MatchPageHeader({ match, competition, isLive, isFinished }: MatchPageHeaderProps) {
  return (
    <MatchHeader match={match} competition={competition} isLive={isLive} isFinished={isFinished} />
  )
}
