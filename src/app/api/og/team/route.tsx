import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const teamName = searchParams.get('teamName') || 'Team';
  const wins = searchParams.get('wins') || '0';
  const draws = searchParams.get('draws') || '0';
  const losses = searchParams.get('losses') || '0';

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e0e0e0',
          fontFamily: 'system-ui, sans-serif',
          padding: '40px',
        }}
      >
        {/* Football emoji and team name */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>⚽</div>
          <div style={{ fontSize: '64px', fontWeight: 'bold', marginBottom: '10px' }}>
            {teamName}
          </div>
          <div style={{ fontSize: '28px', opacity: 0.9 }}>Statistics</div>
        </div>

        {/* W/D/L stats row */}
        <div
          style={{
            display: 'flex',
            gap: '60px',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '30px',
          }}
        >
          {/* Wins */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', color: '#22c55e' }}>{wins}</div>
            <div style={{ fontSize: '24px', opacity: 0.8 }}>Wins</div>
          </div>

          {/* Divider */}
          <div style={{ fontSize: '48px', opacity: 0.4 }}>•</div>

          {/* Draws */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', opacity: 0.7 }}>{draws}</div>
            <div style={{ fontSize: '24px', opacity: 0.8 }}>Draws</div>
          </div>

          {/* Divider */}
          <div style={{ fontSize: '48px', opacity: 0.4 }}>•</div>

          {/* Losses */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', color: '#ef4444' }}>{losses}</div>
            <div style={{ fontSize: '24px', opacity: 0.8 }}>Losses</div>
          </div>
        </div>

        {/* Kroam.xyz branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            fontSize: '16px',
            opacity: 0.7,
          }}
        >
          Kroam.xyz
        </div>

        {/* AI Predictions badge - bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            background: 'rgba(96, 165, 250, 0.2)',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)',
          }}
        >
          AI Predictions
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
