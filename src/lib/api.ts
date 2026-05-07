const BASE_URL = 'https://whisperbox.koyeb.app';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${BASE_URL}${fullPath}`, { ...fetchOptions, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail || err.message || 'Request failed', res.status);
  }

  return res.json() as Promise<T>;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(fullPath)}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail || err.message || 'Request failed', res.status);
  }

  return res.json() as Promise<T>;
}
