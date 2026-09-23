import type {
  SiteDomainStatus,
  UpdateSiteDomainRequest,
  UpdateSiteDomainResult,
} from "@dafthunk/types";

import { makeRequest } from "./utils";

export const SITE_DOMAIN_KEY = "/admin/site-domain";

export async function getSiteDomain(): Promise<SiteDomainStatus> {
  return makeRequest<SiteDomainStatus>(SITE_DOMAIN_KEY);
}

export async function updateSiteDomain(
  siteAddress: string
): Promise<UpdateSiteDomainResult> {
  const body: UpdateSiteDomainRequest = { siteAddress };
  return makeRequest<UpdateSiteDomainResult>(SITE_DOMAIN_KEY, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
