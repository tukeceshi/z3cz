export function isIpHostname(hostname: string): boolean {
  if (hostname.includes(":")) {
    return true;
  }

  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const value = Number(part);
    return value <= 255;
  });
}

/** Loopback and IP hosts cannot carry a Cookie Domain attribute. */
export function isHostOnlyAuthHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "::1" || isIpHostname(hostname)
  );
}

/**
 * A configured public site URL. Empty, loopback, and IP values are not
 * configuration — callers use the request host instead.
 */
export function configuredPublicOrigin(
  webHost: string | undefined
): string | undefined {
  const trimmed = webHost?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname || isHostOnlyAuthHost(url.hostname)) {
      return undefined;
    }
    return trimmed.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export interface AuthCookieScope {
  readonly domain?: string;
  readonly secure: boolean;
}

export function resolveAuthCookieScope(input: {
  readonly configuredWebHost?: string;
  readonly requestHttps: boolean;
}): AuthCookieScope {
  const origin = configuredPublicOrigin(input.configuredWebHost);
  if (!origin) {
    return { secure: input.requestHttps };
  }

  const url = new URL(origin);
  return {
    domain: registrableDomain(url.hostname),
    secure: url.protocol === "https:" || input.requestHttps,
  };
}

function registrableDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid hostname format");
  }
  return parts.slice(-2).join(".");
}
