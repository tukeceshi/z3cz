import { VOLCANO_BILLING_PAGE_DELAY_MS } from "./constants";
import type { VolcengineCredentials } from "./client";
import { callVolcengineBillingApi } from "./billing-client";
import type { VolcanoResourcePackageRow } from "./parse-resource-packages";

interface ListResourcePackagesResult {
  readonly List?: VolcanoResourcePackageRow[];
  readonly NextToken?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchAllVolcanoResourcePackages(params: {
  credentials: VolcengineCredentials;
  status?: string;
}): Promise<VolcanoResourcePackageRow[]> {
  const packages: VolcanoResourcePackageRow[] = [];
  let nextToken: string | null = null;
  let pages = 0;

  do {
    const body: Record<string, unknown> = {
      ResourceType: "Package",
      MaxResults: "20",
    };
    if (params.status) {
      body.Status = params.status;
    }
    if (nextToken) {
      body.NextToken = nextToken;
    }

    const result = await callVolcengineBillingApi<ListResourcePackagesResult>({
      credentials: params.credentials,
      action: "ListResourcePackages",
      body,
    });

    packages.push(...(result.List ?? []));

    const token = result.NextToken;
    nextToken = token && token !== "0" ? token : null;
    pages += 1;

    if (nextToken) {
      await sleep(VOLCANO_BILLING_PAGE_DELAY_MS);
    }
  } while (nextToken && pages < 50);

  return packages;
}
