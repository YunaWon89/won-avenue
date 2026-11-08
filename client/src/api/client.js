/**
 * Centralised API client.
 * - Session lives in an httpOnly cookie, so we only need `credentials: 'include'`.
 * - Errors are normalised to ApiError { status, code, message, fieldErrors }.
 * - 401 on a protected call fires `auth:expired` so the app can log out and redirect.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(status, body = {}) {
    super(body.message || 'Request failed');
    this.status = status;
    this.code = body.code;
    this.restaurantId = body.restaurantId; // multi-restaurant checkout: which restaurant the error is about
    this.fieldErrors = Object.fromEntries((body.errors || []).map((e) => [e.field, e.message]));
  }
}

function buildQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Turn a plain object into FormData (arrays -> comma lists, File kept as file). */
export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined) return;
    if (v instanceof File) fd.append(k, v);
    else if (Array.isArray(v)) fd.append(k, v.join(','));
    else if (v === null) fd.append(k, '');
    else fd.append(k, String(v));
  });
  return fd;
}

export async function request(path, { method = 'GET', body, query, silent401 = false } = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`${BASE}${path}${buildQuery(query)}`, {
      method,
      credentials: 'include',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Network error' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !silent401) window.dispatchEvent(new CustomEvent('auth:expired'));
    // Empty 5xx = the API is unreachable (e.g. dev proxy with the server stopped), not an app error.
    if (res.status >= 500 && !data.code && !data.message) throw new ApiError(0, { code: 'NETWORK', message: 'Network error' });
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path, query, opts) => request(path, { query, ...opts }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

/** Absolute URL for an image path returned by the API. */
export const imageUrl = (path) => {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  const origin = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : '';
  return `${origin}${path}`;
};
