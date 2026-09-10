export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string | string[];
  error?: { message?: string };
};

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    const rawMessage = body?.error?.message || body?.message || `HTTP ${response.status}`;
    const message = Array.isArray(rawMessage) ? rawMessage.join("; ") : rawMessage;
    throw new ApiError(response.status, message);
  }

  if (!body?.success || body.data === undefined) {
    throw new ApiError(response.status, "API trả về dữ liệu không hợp lệ.");
  }

  return body.data;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  return unwrap<T>(response);
}

export async function apiUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  return unwrap<T>(response);
}

export function apiAssetUrl(path: string | null | undefined) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const origin = new URL(API_URL).origin;
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  } catch {
    return path;
  }
}
