import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BASE_URL = 'https://whisperbox.koyeb.app';

export async function GET(req: NextRequest) {
  return proxyRequest(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, 'POST');
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req, 'PUT');
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, 'DELETE');
}

async function proxyRequest(req: NextRequest, method: string) {
  const path = req.nextUrl.searchParams.get('path') || '/';
  const cookieStore = await cookies();
  const token = cookieStore.get('wb_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  const upstream = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
