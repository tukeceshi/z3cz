import {
  mergeVolcanoResourcePackagesByInstance,
  resourcePackageRowKey,
  volcanoResourcePackageStatusesForMode,
  type VolcanoResourcePackageFetchMode,
  type VolcanoResourcePackageRow,
} from "@dafthunk/types";

import { VOLCANO_BILLING_PAGE_DELAY_MS } from "./constants";
import type { VolcengineCredentials } from "./client";
import { callVolcengineBillingApi } from "./billing-client";

interface ListResourcePackagesResult {
  readonly List?: VolcanoResourcePackageRow[];
  readonly NextToken?: string;
}

export interface VolcanoResourcePackageFetchResult {
  readonly rows: VolcanoResourcePackageRow[];
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly pagesPerStatus: Readonly<Record<string, number>>;
  readonly partialErrors: readonly string[];
  readonly durationMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchResourcePackagePages(params: {
  credentials: VolcengineCredentials;
  status: string;
}): Promise<{ rows: VolcanoResourcePackageRow[]; pages: number }> {
  const packages: VolcanoResourcePackageRow[] = [];
  let nextToken: string | null = null;
  let pages = 0;

  do {
    const body: Record<string, unknown> = {
      ResourceType: "Package",
      MaxResults: "20",
      Status: params.status,
    };
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

  return { rows: packages, pages };
}

/**
 * Fetches resource packages by paging each billing Status in parallel.
 *
 * ListResourcePackages without Status only returns Effective rows (see billing probe).
 * Status cannot be multi-valued — each status needs its own paginated pass.
 */
export async function fetchVolcanoResourcePackages(params: {
  credentials: VolcengineCredentials;
  mode?: VolcanoResourcePackageFetchMode;
}): Promise<VolcanoResourcePackageFetchResult> {
  const mode = params.mode ?? "metering";
  const statuses = volcanoResourcePackageStatusesForMode(mode);
  const startedAt = Date.now();

  const settled = await Promise.allSettled(
    statuses.map(async (status) => {
      const { rows, pages } = await fetchResourcePackagePages({
        credentials: params.credentials,
        status,
      });
      return { status, rows, pages };
    })
  );

  const collected: VolcanoResourcePackageRow[] = [];
  const statusCounts: Record<string, number> = {};
  const pagesPerStatus: Record<string, number> = {};
  const partialErrors: string[] = [];

  for (let index = 0; index < settled.length; index += 1) {
    const status = statuses[index] ?? "unknown";
    const result = settled[index];
    if (!result) continue;

    if (result.status === "fulfilled") {
      collected.push(...result.value.rows);
      statusCounts[result.value.status] = result.value.rows.length;
      pagesPerStatus[result.value.status] = result.value.pages;
      continue;
    }

    const message =
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown billing API error";
    partialErrors.push(`Status=${status}: ${message}`);
  }

  if (collected.length === 0 && partialErrors.length > 0) {
    throw new Error(partialErrors.join("; "));
  }

  return {
    rows: mergeVolcanoResourcePackagesByInstance(collected),
    statusCounts,
    pagesPerStatus,
    partialErrors,
    durationMs: Date.now() - startedAt,
  };
}

/** @deprecated Use fetchVolcanoResourcePackages */
export async function fetchAllVolcanoResourcePackages(params: {
  credentials: VolcengineCredentials;
}): Promise<VolcanoResourcePackageRow[]> {
  const result = await fetchVolcanoResourcePackages({
    credentials: params.credentials,
    mode: "metering",
  });
  return result.rows;
}

export { resourcePackageRowKey };
