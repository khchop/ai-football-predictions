import { ImageResponse } from 'next/og';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { getLeaderboard } from '@/lib/db/queries/stats';
import { getTemplateForMatch, getScoreDisplay, getStatusText } from '@/lib/seo/og/templates';
import { mapMatchToSeoData } from '@/lib/seo/types';

export const alt = 'Match Preview';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);
  
  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            backgroundColor: '#1a1a2e',
            color: '#ffffff',
            fontFamily: 'system-ui',
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              marginBottom: 20,
            }}
          >
            Match Not Found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const { match } = result;
  const seoData = mapMatchToSeoData(match);
  const template = getTemplateForMatch(seoData);
  const scoreDisplay = getScoreDisplay(seoData.homeScore, seoData.awayScore, seoData.status);
  const statusText = getStatusText(seoData);

  // Get top model accuracy for the accuracy badge
  let topModelAccuracy: number | null = null;
  try {
    const leaderboard = await getLeaderboard(1);
    if (leaderboard[0]?.accuracy) {
      topModelAccuracy = Math.round(leaderboard[0].accuracy * 10) / 10;
    }
  } catch {
    // Silently fail - accuracy badge is optional enhancement
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          background: template.background.gradient,
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          fontFamily: 'system-ui',
          color: template.textColor,
        }}
      >
        {/* Header with competition and status */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '40px 60px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {seoData.competition}
          </div>
          
          {statusText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px',
                borderRadius: 50,
                backgroundColor: template.statusIndicator?.background || template.badge?.background || 'rgba(255,255,255,0.1)',
                color: template.statusIndicator?.textColor || template.badge?.textColor || '#ffffff',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {template.statusIndicator?.text || template.badge?.text || statusText}
            </div>
          )}
        </div>

        {/* Center section with teams and score */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 40,
          }}
        >
          {/* Teams row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: '0 80px',
            }}
          >
            {/* Home team */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  fontWeight: 'bold',
                }}
              >
                {seoData.homeTeamLogo ? (
                  <img
                    src={seoData.homeTeamLogo}
                    alt={`${seoData.homeTeam} logo`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  seoData.homeTeam.charAt(0)
                )}
              </div>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {seoData.homeTeam}
              </span>
            </div>

            {/* Score */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 30,
                padding: '30px 50px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: 20,
              }}
            >
              <span
                style={{
                  fontSize: 80,
                  fontWeight: 800,
                  letterSpacing: -4,
                }}
              >
                {scoreDisplay}
              </span>
            </div>

            {/* Away team */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  fontWeight: 'bold',
                }}
              >
                {seoData.awayTeamLogo ? (
                  <img
                    src={seoData.awayTeamLogo}
                    alt={`${seoData.awayTeam} logo`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  seoData.awayTeam.charAt(0)
                )}
              </div>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {seoData.awayTeam}
              </span>
            </div>
          </div>

          {/* Accuracy badge - shown when accuracy data available */}
          {topModelAccuracy !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(34, 197, 94, 0.9)',
                padding: '12px 32px',
                borderRadius: '12px',
                fontSize: '24px',
                fontWeight: 'bold',
                marginTop: '20px',
              }}
            >
              Top Model Accuracy: {topModelAccuracy}%
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '30px 60px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            Match Analysis & Predictions
          </span>
          
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              Kroam.xyz
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}