import type { SiteDomainStatus } from "@dafthunk/types";

export type SiteDomainStatusLine =
  | "unavailable"
  | "unreachable"
  | "savedNotApplied"
  | "savedHttpNotApplied"
  | "currentDomain"
  | "currentHttp";

export function siteDomainStatusLine(
  status: Pick<
    SiteDomainStatus,
    "available" | "siteAddress" | "applyError" | "unavailableReason"
  >,
  switching: boolean
): SiteDomainStatusLine {
  if (!status.available) {
    if (status.unavailableReason === "unreachable") {
      return "unreachable";
    }
    return "unavailable";
  }
  if (status.applyError && !switching) {
    if (status.siteAddress) {
      return "savedNotApplied";
    }
    return "savedHttpNotApplied";
  }
  if (status.siteAddress) {
    return "currentDomain";
  }
  return "currentHttp";
}
