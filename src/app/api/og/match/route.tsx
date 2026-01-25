import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const homeTeam = searchParams.get('homeTeam') || 'Home Team';
  const awayTeam = searchParams.get('awayTeam') || 'Away Team';
  const competition = searchParams.get('competition') || 'Match';

  // Helper to truncate long strings
  const truncate = (str: string, max: number) => 
    str.length > max ? str.slice(0, max - 1) + '…' : str;

  const displayHomeTeam = truncate(homeTeam, 25);
  const displayAwayTeam = truncate(awayTeam, 25);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          padding: '40px',
        }}
      >
        {/* Badge */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '20px',
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)',
          }}
        >
          {competition}
        </div>

        {/* Main match title */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            alignItems: 'center',
            marginBottom: '30px',
            textAlign: 'center',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', marginBottom: '10px' }}>
              {displayHomeTeam}
            </div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', opacity: 0.8 }}>vs</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', marginBottom: '10px' }}>
              {displayAwayTeam}
            </div>
          </div>
        </div>

        {/* AI Predictions badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            background: 'rgba(168, 85, 247, 0.4)',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)',
          }}
        >
          AI Predictions
        </div>

        {/* kroam.xyz branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            fontSize: '16px',
            opacity: 0.7,
          }}
        >
          kroam.xyz
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
