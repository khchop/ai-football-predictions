import { ImageResponse } from 'next/og';
import { getMatchBySlug } from '@/lib/db/queries';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';

export const alt = 'Match Preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string; match: string }> }) {
  const { slug, match } = await params;

  const competitionConfig = getCompetitionByIdOrAlias(slug);
  const competitionSlug = competitionConfig?.id || slug;
  const result = await getMatchBySlug(competitionSlug, match);

  if (!result) {
    // Fallback for missing match
    return new ImageResponse(
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', width: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#e0e0e0', fontFamily: 'system-ui',
      }}>
        <div style={{ fontSize: 48, fontWeight: 'bold' }}>Match Not Found</div>
        <div style={{ fontSize: 24, color: '#6b7280', marginTop: 20 }}>Kroam.xyz</div>
      </div>,
      { ...size }
    );
  }

  const { match: matchData, competition } = result;

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: 'system-ui', color: '#e0e0e0',
      }}>
        {/* Header with competition */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 60px',
        }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#60a5fa' }}>{competition.name}</div>
          {matchData.status === 'finished' && matchData.homeScore !== null && (
            <div style={{
              display: 'flex', padding: '8px 20px', borderRadius: 50,
              background: 'rgba(96, 165, 250, 0.2)', fontSize: 22, fontWeight: 700,
            }}>
              Final Score
            </div>
          )}
        </div>

        {/* Center: Teams and score */}
        <div style={{
          display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', padding: '0 60px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40, width: '100%', justifyContent: 'center' }}>
            {/* Home team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ fontSize: 44, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                {matchData.homeTeam}
              </div>
            </div>

            {/* Score or VS */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '20px 40px', borderRadius: 16, background: 'rgba(0,0,0,0.3)',
            }}>
              {matchData.status === 'finished' && matchData.homeScore !== null && matchData.awayScore !== null ? (
                <span style={{ fontSize: 72, fontWeight: 800 }}>
                  {matchData.homeScore} - {matchData.awayScore}
                </span>
              ) : (
                <span style={{ fontSize: 64, fontWeight: 800, color: '#60a5fa' }}>VS</span>
              )}
            </div>

            {/* Away team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ fontSize: 44, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                {matchData.awayTeam}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '30px 60px', borderTop: '2px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>Kroam.xyz</div>
          <div style={{ fontSize: 20, color: '#6b7280' }}>AI-Powered Predictions</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
