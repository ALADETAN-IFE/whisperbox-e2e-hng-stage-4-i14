import { type NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://whisperbox.koyeb.app';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const upstream = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
