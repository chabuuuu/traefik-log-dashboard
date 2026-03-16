import { getPageImage, source } from '@/lib/source';
import { SITE_NAME } from '@/lib/site';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background:
            'radial-gradient(circle at 15% 10%, rgba(102, 19, 45, 0.22), transparent 40%), linear-gradient(120deg, #f9f2e8, #f4e6d4)',
          color: '#3b0f1d',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          height: '100%',
          padding: '56px',
          width: '100%',
        }}
      >
        <div
          style={{
            border: '1px solid rgba(102, 19, 45, 0.2)',
            borderRadius: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            height: '100%',
            justifyContent: 'space-between',
            padding: '40px 44px',
            width: '100%',
            background: 'rgba(255, 252, 248, 0.86)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p
              style={{
                color: '#8c3d4f',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              Documentation
            </p>
            <h1
              style={{
                fontSize: '64px',
                lineHeight: 1.1,
                margin: 0,
                fontWeight: 700,
              }}
            >
              {page.data.title}
            </h1>
            <p
              style={{
                color: '#5f3d3a',
                fontSize: '30px',
                lineHeight: 1.35,
                margin: 0,
              }}
            >
              {page.data.description}
            </p>
          </div>

          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <p
              style={{
                margin: 0,
                color: '#66132d',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              {SITE_NAME}
            </p>
            <p
              style={{
                margin: 0,
                color: '#7d5e58',
                fontSize: '20px',
              }}
            >
              traefik-log-dashboard.hhf.technology
            </p>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageImage(page).segments,
  }));
}
