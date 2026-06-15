export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('Content-Type')?.includes('application/json') ?? false;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  if (isJsonResponse(response)) return response.json();
  const text = await response.text();
  return text || null;
}

function normalizeApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const rawMessage = (payload as { message?: unknown }).message;
    if (Array.isArray(rawMessage)) {
      return rawMessage.map((item) => String(item)).join('; ');
    }
    if (typeof rawMessage === 'string' && rawMessage.trim()) {
      return rawMessage;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return `Request failed with status ${status}`;
}

function redirectOnUnauthorized(status: number) {
  if (status !== 401 || typeof window === 'undefined') return;
  if (window.location.pathname !== '/admin/login') {
    window.location.href = '/admin/login';
  }
}

export async function apiFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const body = init.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    redirectOnUnauthorized(response.status);
    const message = normalizeApiErrorMessage(payload, response.status);
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function apiGet<T = unknown>(url: string, init: RequestInit = {}) {
  return apiFetch<T>(url, { ...init, method: 'GET' });
}

export function apiPost<T = unknown>(url: string, body?: unknown, init: RequestInit = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestBody = isFormData ? body : body === undefined ? undefined : JSON.stringify(body);
  return apiFetch<T>(url, { ...init, method: 'POST', body: requestBody });
}

export function apiPatch<T = unknown>(url: string, body?: unknown, init: RequestInit = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestBody = isFormData ? body : body === undefined ? undefined : JSON.stringify(body);
  return apiFetch<T>(url, { ...init, method: 'PATCH', body: requestBody });
}

export function apiDelete<T = unknown>(url: string, init: RequestInit = {}) {
  return apiFetch<T>(url, { ...init, method: 'DELETE' });
}
