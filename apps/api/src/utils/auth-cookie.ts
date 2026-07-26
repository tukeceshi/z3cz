/**
 * Auth cookies must not use Secure on plain HTTP (e.g. self-host LE rate-limit fallback).
 */
export function authCookieSecure(webHost: string): boolean {
  try {
    const url = new URL(webHost);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return false;
    }
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
