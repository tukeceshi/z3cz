import type { OrgModelChannelKind } from "./org-model-label";

export const OFFICIAL_SINGLE_MODEL_ROOT_DOMAINS = [
  "deepseek.com",
  "volces.com",
  "moonshot.cn",
  "moonshot.ai",
  "openai.com",
  "googleapis.com",
  "x.ai",
  "anthropic.com",
  "minimaxi.com",
] as const;

const OFFICIAL_ROOT_DOMAIN_SET = new Set<string>(
  OFFICIAL_SINGLE_MODEL_ROOT_DOMAINS
);

export function rootDomainFromEndpointUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const hostname = new URL(trimmed).hostname.toLowerCase().replace(/\.$/, "");
    const parts = hostname.split(".").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  } catch {
    return null;
  }
}

export function isOfficialOrgModelEndpoint(params: {
  readonly channelKind: OrgModelChannelKind;
  readonly baseUrl?: string | null;
}): boolean {
  if (params.channelKind === "aggregate") {
    return true;
  }
  const domain = rootDomainFromEndpointUrl(params.baseUrl ?? "");
  return domain !== null && OFFICIAL_ROOT_DOMAIN_SET.has(domain);
}
