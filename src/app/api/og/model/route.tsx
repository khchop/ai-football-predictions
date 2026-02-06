import { ImageResponse } from 'next/og';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const modelName = searchParams.get('modelName') || 'AI Model';
  const accuracy = searchParams.get('accuracy') || '0';
  const rank = searchParams.get('rank') || '—';

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
        {/* Rank badge - top left */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '32px',
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)',
          }}
        >
          #{rank}
        </div>

        {/* Model name - main content */}
        <div style={{ marginBottom: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', fontWeight: 'bold', marginBottom: '20px' }}>
            {modelName}
          </div>
          <div style={{ fontSize: '28px', opacity: 0.9, color: '#60a5fa' }}>AI Model Performance</div>
        </div>

        {/* Accuracy stat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '56px', fontWeight: 'bold' }}>{accuracy}%</div>
          <div style={{ fontSize: '28px', opacity: 0.8 }}>Accurate</div>
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
