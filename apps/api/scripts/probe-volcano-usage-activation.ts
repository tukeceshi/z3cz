/**
 * Test whether GetInferenceUsage can distinguish model activation
 * without calling inference APIs.
 *
 * Ground truth (from inference probe 2026-07-11):
 *   NOT_OPEN: doubao-seed-evolving, doubao-seedance-2-0-mini-260615
 *   OPEN:     all other catalog models
 */
import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { formatVolcanoUsageDate } from "../src/integrations/volcengine/get-inference-usage";

const GROUND_TRUTH_OPEN = new Set([
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "doubao-seedance-2",
  "doubao-seedance-2-fast",
  "doubao-seedream-5-pro",
  "doubao-seedream-5",
]);

const GROUND_TRUTH_NOT_OPEN = new Set([
  "doubao-seed-evolving",
  "doubao-seedance-2-mini",
]);

interface UsageProbeOutcome {
  readonly label: string;
  readonly canonicalId: string;
  readonly expectedOpen: boolean;
  readonly ok: boolean;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly dataCount: number | null;
  readonly fieldNames: readonly string[];
  readonly rowCount: number;
  readonly rowSample: string;
  readonly rawSnippet: string;
}

function buildWindow(): { startTime: string; endTime: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return {
    startTime: formatVolcanoUsageDate(start),
    endTime: formatVolcanoUsageDate(now),
  };
}

function foundationNameFromModelId(modelId: string): string {
  return modelId.replace(/-\d{6}$/, "");
}

async function probeUsage(
  credentials: { accessKeyId: string; secretAccessKey: string; region: string },
  label: string,
  canonicalId: string,
  body: Record<string, unknown>
): Promise<UsageProbeOutcome> {
  const expectedOpen = GROUND_TRUTH_OPEN.has(canonicalId);

  try {
    const raw = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "GetInferenceUsage",
      body,
    });

    const fields = raw.Fields;
    const fieldNames = Array.isArray(fields)
      ? fields
          .map((f) =>
            f && typeof f === "object"
              ? String((f as Record<string, unknown>).Name ?? "")
              : ""
          )
          .filter(Boolean)
      : [];

    const rows = raw.Rows ?? raw.rows ?? [];
    const rowArray = Array.isArray(rows) ? rows : [];
    const dataCount =
      typeof raw.DataCount === "number" ? raw.DataCount : rowArray.length;

    return {
      label,
      canonicalId,
      expectedOpen,
      ok: true,
      errorCode: null,
      errorMessage: null,
      dataCount,
      fieldNames,
      rowCount: rowArray.length,
      rowSample: JSON.stringify(rowArray.slice(0, 2)).slice(0, 400),
      rawSnippet: JSON.stringify(raw).slice(0, 600),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const codeMatch = message.match(/\b([A-Z][A-Za-z0-9_.]+)\b/);
    return {
      label,
      canonicalId,
      expectedOpen,
      ok: false,
      errorCode: codeMatch?.[1] ?? null,
      errorMessage: message,
      dataCount: null,
      fieldNames: [],
      rowCount: 0,
      rowSample: "",
      rawSnippet: message.slice(0, 600),
    };
  }
}

async function main(): Promise<void> {
  const accessKeyId = process.env.VOLC_AK;
  const secretAccessKey = process.env.VOLC_SK;
  if (!accessKeyId || !secretAccessKey) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
    region: "cn-beijing",
  };

  const window = buildWindow();
  const base = {
    StartTime: window.startTime,
    EndTime: window.endTime,
    QueryInterval: "Day",
    ProjectName: "default",
  };

  const outcomes: UsageProbeOutcome[] = [];

  // Baseline: no filter
  outcomes.push(
    await probeUsage(credentials, "no-filter", "_baseline", base)
  );

  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const modelId = entry.providerModelId;
    const foundationName = foundationNameFromModelId(modelId);

    const variants: { label: string; body: Record<string, unknown> }[] = [
      { label: "ModelName=modelId", body: { ...base, ModelName: modelId } },
      {
        label: "ModelName=foundation",
        body: { ...base, ModelName: foundationName },
      },
      { label: "ModelNames=[modelId]", body: { ...base, ModelNames: [modelId] } },
      {
        label: "ModelNames=[foundation]",
        body: { ...base, ModelNames: [foundationName] },
      },
      {
        label: "Filter.ModelName",
        body: { ...base, Filter: { ModelName: modelId } },
      },
      {
        label: "GroupBy ModelName",
        body: { ...base, GroupByFields: ["ModelName"] },
      },
      {
        label: "GroupBy ModelName+Billing",
        body: { ...base, GroupByFields: ["ModelName", "BillingStatus"] },
      },
      {
        label: "ModelName+Billing free",
        body: {
          ...base,
          ModelName: modelId,
          BillingStatus: "free_for_free_quota",
        },
      },
    ];

    for (const variant of variants) {
      outcomes.push(
        await probeUsage(
          credentials,
          variant.label,
          entry.canonicalId,
          variant.body
        )
      );
    }
  }

  // Try other usage-related actions
  const otherActions = [
    ["GetInferenceUsageSummary", base],
    ["ListInferenceUsage", { PageNumber: 1, PageSize: 20, ...base }],
    ["GetModelUsage", { ModelName: "doubao-seed-evolving", ...base }],
    ["GetModelUsage", { ModelName: "deepseek-v4-pro-260425", ...base }],
    ["ListModelUsage", base],
    ["GetFoundationModelUsage", { Name: "doubao-seed-evolving" }],
    ["GetFoundationModelUsage", { FoundationModelName: "doubao-seed-evolving" }],
  ] as const;

  for (const [action, body] of otherActions) {
    try {
      const raw = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action,
        body,
      });
      console.log(`\n=== OK other action ${action} ===`);
      console.log(JSON.stringify(raw, null, 2).slice(0, 800));
    } catch (error) {
      console.log(
        `\n=== FAIL other action ${action} ===`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Analysis
  console.log("\n\n######## Per-model summary (ModelName=modelId) ########\n");
  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const hit = outcomes.find(
      (o) =>
        o.canonicalId === entry.canonicalId &&
        o.label === "ModelName=modelId"
    );
    if (!hit) continue;
    const tag = hit.expectedOpen ? "OPEN" : "NOT_OPEN";
    console.log(
      `[${tag}] ${entry.canonicalId}: ok=${hit.ok} dataCount=${hit.dataCount} fields=[${hit.fieldNames.join(",")}] err=${hit.errorCode ?? "-"}`
    );
    if (hit.rowSample) console.log(`  rows: ${hit.rowSample}`);
  }

  console.log("\n######## Discriminators: can usage API tell open vs not? ########\n");

  const discriminators = [
    "ok",
    "errorCode",
    "dataCount",
    "fieldNames includes ModelName",
    "fieldNames includes BillingStatus",
  ];

  for (const label of [
    "ModelName=modelId",
    "ModelName=foundation",
    "ModelNames=[modelId]",
    "GroupBy ModelName",
  ]) {
    const subset = outcomes.filter((o) => o.label === label);
    const open = subset.filter((o) => o.expectedOpen);
    const closed = subset.filter((o) => !o.expectedOpen);

    const openOk = open.filter((o) => o.ok).length;
    const closedOk = closed.filter((o) => o.ok).length;
    const openErr = open.filter((o) => !o.ok);
    const closedErr = closed.filter((o) => !o.ok);

    const openFields = new Set(open.flatMap((o) => o.fieldNames));
    const closedFields = new Set(closed.flatMap((o) => o.fieldNames));

    const openHasModel = open.filter((o) =>
      o.fieldNames.some((f) => f === "ModelName" || f === "FoundationModelName")
    ).length;
    const closedHasModel = closed.filter((o) =>
      o.fieldNames.some((f) => f === "ModelName" || f === "FoundationModelName")
    ).length;

    const openDataCounts = open.map((o) => o.dataCount).join(",");
    const closedDataCounts = closed.map((o) => o.dataCount).join(",");

    console.log(`--- ${label} ---`);
    console.log(`  OPEN:     ok=${openOk}/${open.length} dataCount=[${openDataCounts}] hasModelField=${openHasModel}/${open.length}`);
    console.log(`  NOT_OPEN: ok=${closedOk}/${closed.length} dataCount=[${closedDataCounts}] hasModelField=${closedHasModel}/${closed.length}`);
    if (openErr.length) {
      console.log(`  OPEN errors: ${openErr.map((o) => `${o.canonicalId}:${o.errorMessage?.slice(0, 80)}`).join("; ")}`);
    }
    if (closedErr.length) {
      console.log(`  NOT_OPEN errors: ${closedErr.map((o) => `${o.canonicalId}:${o.errorMessage?.slice(0, 80)}`).join("; ")}`);
    }
    console.log(`  OPEN fields union: ${[...openFields].join(",") || "(none)"}`);
    console.log(`  NOT_OPEN fields union: ${[...closedFields].join(",") || "(none)"}`);
  }

  console.log("\n######## Full JSON ########\n");
  console.log(JSON.stringify(outcomes, null, 2));
}

void main();
