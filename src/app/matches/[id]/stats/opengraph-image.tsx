import { ImageResponse } from 'next/og';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { mapMatchToSeoData } from '@/lib/seo/types';
import { BASE_URL } from '@/lib/seo/constants';

export const alt = 'Match Statistics';

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

  // Stats-focused design with analytical styling
  const homeTeamColor = '#4ade80'; // Green
  const awayTeamColor = '#f87171'; // Red
  const accentColor = '#60a5fa'; // Blue for stats focus

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(to bottom right, #1e293b, #0f172a)',
          fontFamily: 'system-ui',
          color: '#ffffff',
        }}
      >
        {/* Header with stats badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '40px 60px',
            background: 'linear-gradient(to right, rgba(96, 165, 250, 0.1), transparent)',
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
          
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 24px',
              borderRadius: 50,
              backgroundColor: 'rgba(96, 165, 250, 0.2)',
              color: '#60a5fa',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            📊 Statistics & Predictions
          </div>
        </div>

        {/* Center section with teams and stats visualization */}
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
          {/* Teams row with score */}
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
                  width: 100,
                  height: 100,
                  borderRadius: 16,
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  fontWeight: 'bold',
                  border: '3px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                {seoData.homeTeamLogo ? (
                  <img
                    src={seoData.homeTeamLogo}
                    alt={`${seoData.homeTeam} logo`}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  seoData.homeTeam.charAt(0)
                )}
              </div>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {seoData.homeTeam}
              </span>
            </div>

            {/* Score display */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '25px 45px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 16,
                border: '2px solid rgba(96, 165, 250, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  letterSpacing: -2,
                  color: '#60a5fa',
                }}
              >
                {seoData.homeScore !== null ? seoData.homeScore : '-'}
              </span>
              <span
                style={{
                  fontSize: 40,
                  color: '#64748b',
                }}
              >
                -
              </span>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  letterSpacing: -2,
                  color: '#60a5fa',
                }}
              >
                {seoData.awayScore !== null ? seoData.awayScore : '-'}
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
                  width: 100,
                  height: 100,
                  borderRadius: 16,
                  backgroundColor: 'rgba(248, 113, 113, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  fontWeight: 'bold',
                  border: '3px solid rgba(248, 113, 113, 0.3)',
                }}
              >
                {seoData.awayTeamLogo ? (
                  <img
                    src={seoData.awayTeamLogo}
                    alt={`${seoData.awayTeam} logo`}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  seoData.awayTeam.charAt(0)
                )}
              </div>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {seoData.awayTeam}
              </span>
            </div>
          </div>

          {/* Stats section indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 32px',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              borderRadius: 12,
              border: '1px solid rgba(96, 165, 250, 0.2)',
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#60a5fa',
              }}
            >
              📈 Detailed Statistics & Performance Metrics
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '30px 60px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(to left, rgba(96, 165, 250, 0.05), transparent)',
          }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                opacity: 0.9,
              }}
            >
              Match Statistics Dashboard
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
                BettingSoccer
              </span>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
}