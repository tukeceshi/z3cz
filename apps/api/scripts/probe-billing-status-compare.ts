/**
 * Compare ListResourcePackages with vs without Status filter.
 * Run: VOLC_AK=... VOLC_SK=... pnpm exec tsx scripts/probe-billing-status-compare.ts
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

interface PackageRow {
  readonly InstanceNo?: string;
  readonly ConfigurationCode?: string;
  readonly Status?: string;
  readonly TotalAmount?: string;
  readonly AvailableAmount?: string;
}

async function fetchAll(body: Record<string, unknown>): Promise<{
  rows: PackageRow[];
  pages: number;
  error?: string;
}> {
  const rows: PackageRow[] = [];
  let nextToken: string | null = null;
  let pages = 0;

  do {
    const reqBody = { ...body };
    if (nextToken) reqBody.NextToken = nextToken;

    const signed = await signVolcengineRequest({
      accessKeyId: process.env.VOLC_AK!.trim(),
      secretAccessKey: process.env.VOLC_SK!.trim(),
      region: "cn-beijing",
      service: "billing",
      host: "billing.volcengineapi.com",
      method: "POST",
      action: "ListResourcePackages",
      version: "2022-01-01",
      body: reqBody,
    });

    const response = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    });
    const payload = (await response.json()) as {
      ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
      Result?: { List?: PackageRow[]; NextToken?: string };
    };
    const err = payload.ResponseMetadata?.Error;
    if (err) {
      return { rows, pages, error: `${err.Code}: ${err.Message}` };
    }

    rows.push(...(payload.Result?.List ?? []));
    const token = payload.Result?.NextToken;
    nextToken = token && token !== "0" ? token : null;
    pages += 1;
    if (nextToken) await new Promise((r) => setTimeout(r, 350));
  } while (nextToken && pages < 50);

  return { rows, pages };
}

function statusCounts(rows: readonly PackageRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.Status ?? "(null)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function instanceKeys(rows: readonly PackageRow[]): Set<string> {
  return new Set(
    rows.map((row) => row.InstanceNo?.trim() ?? `no-instance:${row.ConfigurationCode}:${row.Status}`)
  );
}

function printCounts(label: string, counts: Map<string, number>): void {
  console.log(`\n${label}`);
  for (const [status, count] of [...counts.entries()].sort()) {
    console.log(`  ${status}: ${count}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const variants = [
    { label: "NO Status (ResourceType=Package only)", body: { ResourceType: "Package", MaxResults: "20" } },
    { label: "Status=Effective", body: { ResourceType: "Package", MaxResults: "20", Status: "Effective" } },
    { label: "Status=UsedUp", body: { ResourceType: "Package", MaxResults: "20", Status: "UsedUp" } },
    { label: "Status=Expired", body: { ResourceType: "Package", MaxResults: "20", Status: "Expired" } },
  ] as const;

  const results = new Map<string, { rows: PackageRow[]; pages: number; error?: string }>();

  for (const variant of variants) {
    const result = await fetchAll(variant.body);
    results.set(variant.label, result);
    console.log(`\n=== ${variant.label} ===`);
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
      continue;
    }
    console.log(`pages=${result.pages} total=${result.rows.length}`);
    printCounts("By Status", statusCounts(result.rows));
    await new Promise((r) => setTimeout(r, 400));
  }

  const noStatus = results.get("NO Status (ResourceType=Package only)");
  const usedUp = results.get("Status=UsedUp");
  const expired = results.get("Status=Expired");
  const effective = results.get("Status=Effective");

  if (!noStatus || noStatus.error || !usedUp || usedUp.error) {
    return;
  }

  const noStatusKeys = instanceKeys(noStatus.rows);
  const usedUpOnly = usedUp.rows.filter((row) => {
    const key = row.InstanceNo?.trim() ?? `no-instance:${row.ConfigurationCode}:${row.Status}`;
    return !noStatusKeys.has(key);
  });
  const expiredOnly = expired?.rows.filter((row) => {
    const key = row.InstanceNo?.trim() ?? `no-instance:${row.ConfigurationCode}:${row.Status}`;
    return !noStatusKeys.has(key);
  }) ?? [];

  console.log("\n######## CONCLUSION ########");
  console.log(
    `NO Status total=${noStatus.rows.length} | Effective pass=${effective?.rows.length ?? "?"} | UsedUp pass=${usedUp.rows.length} | Expired pass=${expired?.rows.length ?? "?"}`
  );
  console.log(`UsedUp rows NOT in NO-Status fetch: ${usedUpOnly.length}`);
  console.log(`Expired rows NOT in NO-Status fetch: ${expiredOnly.length}`);

  const seedanceCode = "Doubao_Seedance_2.0_pack_free_infer";
  for (const [label, data] of results) {
    if (data.error) continue;
    const seedance = data.rows.filter((r) => r.ConfigurationCode === seedanceCode);
    if (seedance.length > 0) {
      console.log(`\nSeedance 2.0 in [${label}]:`);
      for (const row of seedance) {
        console.log(
          `  ${row.Status} ${row.AvailableAmount}/${row.TotalAmount} ${row.InstanceNo}`
        );
      }
    }
  }

  if (usedUpOnly.length > 0) {
    console.log("\nSample UsedUp-only instances (first 5):");
    for (const row of usedUpOnly.slice(0, 5)) {
      console.log(
        `  ${row.ConfigurationCode} ${row.Status} ${row.AvailableAmount}/${row.TotalAmount} ${row.InstanceNo}`
      );
    }
  }

  const canFetchAllWithoutStatus =
    usedUpOnly.length === 0 &&
    expiredOnly.length === 0 &&
    (noStatus.rows.length >= (usedUp.rows.length + (expired?.rows.length ?? 0)));
  console.log(
    `\nCan fetch full data WITHOUT Status param? ${canFetchAllWithoutStatus ? "YES (this account)" : "NO — must query per Status"}`
  );
}

void main();
