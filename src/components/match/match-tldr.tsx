import type { Match, Competition } from '@/lib/db/schema'

interface MatchTLDRProps {
  match: Match
  competition: Competition
}

export function MatchTLDR({ match, competition }: MatchTLDRProps) {
  const isUpcoming = match.status === 'scheduled'
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  let tldr: string

  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    // Finished: "[Winner] won [score] in [competition]" or "Match ended [score] in [competition]"
    const homeWon = match.homeScore > match.awayScore
    const awayWon = match.awayScore > match.homeScore
    const isDraw = match.homeScore === match.awayScore

    if (isDraw) {
      tldr = `${match.homeTeam} and ${match.awayTeam} drew ${match.homeScore}-${match.awayScore} in the ${competition.name}.`
    } else {
      const winner = homeWon ? match.homeTeam : match.awayTeam
      const loser = homeWon ? match.awayTeam : match.homeTeam
      const winnerScore = homeWon ? match.homeScore : match.awayScore
      const loserScore = homeWon ? match.awayScore : match.homeScore
      tldr = `${winner} beat ${loser} ${winnerScore}-${loserScore} in the ${competition.name}.`
    }
  } else if (isLive && match.homeScore !== null && match.awayScore !== null) {
    // Live: "[Score] as of now"
    tldr = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. Match in progress.`
  } else {
    // Upcoming: "AI models predict the outcome of [teams] in [competition]"
    tldr = `AI models predict the outcome of ${match.homeTeam} vs ${match.awayTeam} in the ${competition.name}. View predictions below.`
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
      <p className="text-foreground font-medium text-base md:text-lg leading-relaxed">
        {tldr}
      </p>
    </div>
  )
}
