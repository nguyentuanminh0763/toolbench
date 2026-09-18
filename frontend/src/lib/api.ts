/**
 * The only place that calls fetch. Pages must go through this module.
 *
 * Why: changing error handling, headers or the path prefix stays a one-file edit.
 *
 * Types are hand-written. Once the API grows past ~15 endpoints, replace this
 * with @hey-api/openapi-ts generated from /openapi.json — that is the point
 * where hand-written types start drifting from the backend unnoticed.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// sessionStorage, not localStorage: closing the tab ends the session, matching
// the server, which drops its key when it stops.
const TOKEN_KEY = 'auth_token'

export const token = {
  get: () => sessionStorage.getItem(TOKEN_KEY) ?? '',
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

/**
 * The low-level caller. Features import this and build their own api.ts, so
 * every request still gets the auth header and the same error handling.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // A custom header forces a CORS preflight, so a page on another origin
      // cannot fire a blind write at 127.0.0.1.
      'X-Auth': token.get(),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    // FastAPI puts the message in `detail`. Reading it means the user sees the
    // sentence we wrote, not a generic "Request failed".
    let message = `Error ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') message = body.detail
    } catch {
      /* not JSON — keep the default message */
    }
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export type AuthState = { configured: boolean; unlocked: boolean }
export type TestResult = { ok: boolean; message: string }

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  authState: () => request<AuthState>('/auth/state'),
  setup: (password: string) =>
    request<{ token: string }>('/auth/setup', { method: 'POST', body: JSON.stringify({ password }) }),
  unlock: (password: string) =>
    request<{ token: string }>('/auth/unlock', { method: 'POST', body: JSON.stringify({ password }) }),
  lock: () => request<{ ok: boolean }>('/auth/lock', { method: 'POST' }),

  testWordpress: () => request<TestResult>('/wordpress/test', { method: 'POST' }),

  getSettings: () => request<Record<string, string>>('/settings'),
  saveSettings: (values: Record<string, string>) =>
    request<Record<string, string>>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }),
}
