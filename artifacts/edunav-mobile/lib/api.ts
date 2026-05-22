import AsyncStorage from "@react-native-async-storage/async-storage";

import { getDemoResponse, isDemoMode } from "./demo-data";

const COOKIE_KEY = "edunav.sessionCookie";

let cachedCookie: string | null = null;
let cookieLoaded = false;

async function loadCookie(): Promise<string | null> {
  if (!cookieLoaded) {
    cachedCookie = await AsyncStorage.getItem(COOKIE_KEY);
    cookieLoaded = true;
  }
  return cachedCookie;
}

export async function setSessionCookie(value: string | null): Promise<void> {
  cachedCookie = value;
  cookieLoaded = true;
  if (value) {
    await AsyncStorage.setItem(COOKIE_KEY, value);
  } else {
    await AsyncStorage.removeItem(COOKIE_KEY);
  }
}

export async function getSessionCookie(): Promise<string | null> {
  return await loadCookie();
}

export function getApiBase(): string {
  // Production builds (EAS) bake in EXPO_PUBLIC_API_URL — a full https URL.
  const explicit = process.env["EXPO_PUBLIC_API_URL"];
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/+$/, "");
  }
  // Dev workflow uses EXPO_PUBLIC_DOMAIN (the Replit dev hostname).
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (!domain) {
    throw new Error(
      "API base not configured. Set EXPO_PUBLIC_API_URL (production) or EXPO_PUBLIC_DOMAIN (dev).",
    );
  }
  return `https://${domain}`;
}

function captureCookie(res: Response): void {
  // React Native exposes set-cookie via headers.get("set-cookie") (concatenated).
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  // Find sessionId cookie (we set name: "sessionId" in express-session)
  const match = setCookie.match(/sessionId=[^;,]+/);
  if (match) {
    void setSessionCookie(match[0]);
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  // Demo mode short-circuit: when the bundle has demo mode enabled, route
  // recognized requests to canned fixtures so screens render realistic
  // content without a live backend or real account. Unknown requests fall
  // through to the real fetch.
  if (isDemoMode()) {
    const demo = getDemoResponse(method, path, body);
    if (demo !== undefined) {
      return demo as T;
    }
  }

  const cookie = await loadCookie();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;

  const url = path.startsWith("http") ? path : `${getApiBase()}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  captureCookie(res);

  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const text = await res.text();
      msg = text || res.statusText;
    } catch {
      msg = res.statusText;
    }
    const err = new Error(`${res.status}: ${msg}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  // Some endpoints return empty body
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  // @ts-expect-error - allow void returns
  return undefined;
}

export async function apiGet<T = unknown>(
  path: string,
  options: { allowUnauthorized?: boolean } = {},
): Promise<T | null> {
  try {
    return await apiRequest<T>("GET", path);
  } catch (e) {
    const err = e as Error & { status?: number };
    if (options.allowUnauthorized && err.status === 401) return null;
    throw e;
  }
}
