export interface VolcanoUsageMetrics {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly imageCount: number;
  readonly requestCount: number;
}

export interface VolcanoParsedUsageRow {
  readonly modelName: string | null;
  readonly billingStatus: string | null;
  readonly day: string | null;
  readonly metrics: VolcanoUsageMetrics;
}

export interface VolcanoParsedInferenceUsage {
  readonly fieldNames: readonly string[];
  readonly rows: readonly VolcanoParsedUsageRow[];
  readonly totals: VolcanoUsageMetrics;
}

const METRIC_FIELDS = {
  inputTokens: "InputTokens",
  outputTokens: "OutputTokens",
  totalTokens: "TotalTokens",
  imageCount: "ImageCount",
  requestCount: "ReqCnt",
} as const;

const EMPTY_METRICS: VolcanoUsageMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  imageCount: 0,
  requestCount: 0,
};

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readVolcanoUsageFieldNames(
  payload: Record<string, unknown>
): string[] {
  const fields = payload.Fields ?? payload.fields;
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .map((field) => {
      if (!field || typeof field !== "object") return null;
      const name = (field as Record<string, unknown>).Name;
      return typeof name === "string" ? name : null;
    })
    .filter((name): name is string => name !== null);
}

function readRows(payload: Record<string, unknown>): unknown[] {
  const rows = payload.Rows ?? payload.rows ?? payload.Data ?? payload.data;
  return Array.isArray(rows) ? rows : [];
}

function readMetricFromRecord(
  record: Record<string, unknown>
): VolcanoUsageMetrics {
  return {
    inputTokens: readNumber(record[METRIC_FIELDS.inputTokens]),
    outputTokens: readNumber(record[METRIC_FIELDS.outputTokens]),
    totalTokens: readNumber(record[METRIC_FIELDS.totalTokens]),
    imageCount: readNumber(record[METRIC_FIELDS.imageCount]),
    requestCount: readNumber(record[METRIC_FIELDS.requestCount]),
  };
}

function readMetricFromArrayRow(
  row: unknown[],
  fieldNames: readonly string[]
): VolcanoUsageMetrics {
  const record: Record<string, unknown> = {};
  for (let index = 0; index < fieldNames.length; index += 1) {
    const name = fieldNames[index];
    if (!name) continue;
    record[name] = row[index];
  }
  return readMetricFromRecord(record);
}

function addMetrics(
  left: VolcanoUsageMetrics,
  right: VolcanoUsageMetrics
): VolcanoUsageMetrics {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    imageCount: left.imageCount + right.imageCount,
    requestCount: left.requestCount + right.requestCount,
  };
}

function readRow(
  row: unknown,
  fieldNames: readonly string[]
): VolcanoParsedUsageRow {
  const record =
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as Record<string, unknown>)
      : Array.isArray(row)
        ? Object.fromEntries(
            fieldNames.map((name, index) => [name, row[index]])
          )
        : {};

  return {
    modelName:
      readString(record.ModelName ?? record.modelName) ??
      readString(record.FoundationModelName ?? record.foundationModelName),
    billingStatus: readString(record.BillingStatus ?? record.billingStatus),
    day: readString(record.Day ?? record.day),
    metrics: readMetricFromRecord(record),
  };
}

export function parseVolcanoInferenceUsageRaw(
  payload: Record<string, unknown>
): VolcanoParsedInferenceUsage {
  const fieldNames = readVolcanoUsageFieldNames(payload);
  const parsedRows = readRows(payload).map((row) => {
    if (Array.isArray(row)) {
      const metrics = readMetricFromArrayRow(row, fieldNames);
      const record = Object.fromEntries(
        fieldNames.map((name, index) => [name, row[index]])
      );
      return {
        modelName:
          readString(record.ModelName ?? record.modelName) ??
          readString(record.FoundationModelName ?? record.foundationModelName),
        billingStatus: readString(record.BillingStatus ?? record.billingStatus),
        day: readString(record.Day ?? record.day),
        metrics,
      };
    }
    return readRow(row, fieldNames);
  });

  const totals = parsedRows.reduce(
    (sum, row) => addMetrics(sum, row.metrics),
    { ...EMPTY_METRICS }
  );

  return {
    fieldNames,
    rows: parsedRows,
    totals,
  };
}

export function metricForModality(
  metrics: VolcanoUsageMetrics,
  modality: "text" | "image" | "video"
): number {
  if (modality === "image") return metrics.imageCount;
  return metrics.totalTokens;
}
