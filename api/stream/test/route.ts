// app/api/stream/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TARGET_BASE = 'http://khanmalik.io:80/live/Khemprakash/skyplay2421';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const targetUrl = `${TARGET_BASE}/${path}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      return new NextResponse('Stream unavailable', { 
        status: response.status 
      });
    }

    const contentType = response.headers.get('content-type') ||
      (path.endsWith('.m3u8') 
        ? 'application/vnd.apple.mpegurl' 
        : 'video/MP2T');

    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    });

    // Forward important streaming headers
    ['content-length', 'content-range', 'accept-ranges'].forEach((key) => {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    return new NextResponse('Proxy Error', { status: 502 });
  }
}
