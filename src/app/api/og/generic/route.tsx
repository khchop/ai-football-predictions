import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'AI Football Predictions';
  const subtitle = searchParams.get('subtitle') || 'Compare AI models predicting football across 17 leagues';

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#e0e0e0',
        fontFamily: 'system-ui',
        padding: '60px',
      }}>
        {/* Accent bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#60a5fa' }}>Kroam.xyz</div>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.2, marginBottom: 20 }}>{title}</div>
          <div style={{ fontSize: 28, color: '#9ca3af' }}>{subtitle}</div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid rgba(255,255,255,0.1)',
          paddingTop: 30,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>Kroam.xyz</div>
          <div style={{ fontSize: 20, color: '#6b7280' }}>AI-Powered Predictions</div>
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
