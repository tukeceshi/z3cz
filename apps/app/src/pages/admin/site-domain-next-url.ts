export interface SiteDomainLocation {
  readonly protocol: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

export interface SiteDomainJumpOptions {
  readonly switching: boolean;
  readonly applyError: string | null;
}

export function siteDomainNeedsJump(
  siteAddress: string,
  currentHostname: string
): boolean {
  return currentHostname.toLowerCase() !== siteAddress.toLowerCase();
}

export function siteDomainPublicUrl(
  siteAddress: string,
  current: Pick<SiteDomainLocation, "pathname" | "search" | "hash">
): string {
  const pathname = current.pathname || "/";
  return `https://${siteAddress}${pathname}${current.search}${current.hash}`;
}

export function siteDomainJumpUrl(
  siteAddress: string | null,
  current: SiteDomainLocation,
  options: SiteDomainJumpOptions
): string | null {
  if (options.applyError && !options.switching) {
    return null;
  }
  if (siteAddress) {
    if (!siteDomainNeedsJump(siteAddress, current.hostname)) {
      return null;
    }
    return siteDomainPublicUrl(siteAddress, current);
  }
  if (current.protocol !== "https:") {
    return null;
  }
  return `http://${current.hostname}${current.pathname}${current.search}${current.hash}`;
}

export async function probeSiteUrl(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}
