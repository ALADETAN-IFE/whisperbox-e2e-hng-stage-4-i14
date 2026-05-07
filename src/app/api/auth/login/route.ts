import { type NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://whisperbox.koyeb.app';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const upstream = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const token = data.access_token || data.token;
  if (!token) {
    return NextResponse.json({ detail: 'No token in response' }, { status: 500 });
  }

  const res = NextResponse.json({
    // Return everything EXCEPT the token — client gets user info but NOT the raw token
    user_id: data.user_id || data.id || null,
    username: body.username,
  });

  // Set token in HttpOnly cookie — JS cannot read this
  res.cookies.set('wb_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}
