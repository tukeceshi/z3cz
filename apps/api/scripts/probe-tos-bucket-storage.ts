import { createDatabase } from "../src/db/index";
import { getOrganizationAiInterfaceRow } from "../src/db/ai-interface-queries";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { callVolcengineMonitorApi } from "../src/integrations/volcengine/monitor-client";
import { queryTosBucketStorageGiB } from "../src/integrations/volcengine/query-tos-bucket-storage";
import { isVolcanoMetadata, parseInterfaceMetadata } from "../src/integrations/volcengine/metadata";

const orgId = process.argv[2] ?? "019f9cf9-e5b3-720f-9b26-babb3ed15830";
const ifaceId = process.argv[3] ?? "41713747-0341-45b1-ab4f-3c3c7a9cb184";

async function main(): Promise<void> {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    SECRET_MASTER_KEY: process.env.SECRET_MASTER_KEY,
  } as const;
  const db = createDatabase(env);
  const row = await getOrganizationAiInterfaceRow(db, orgId, ifaceId);
  if (!row) {
    throw new Error("Interface not found");
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    throw new Error("Not volcano metadata");
  }

  const credentials = await getVolcanoCredentials(env, orgId, row.metadata);
  if (!credentials) {
    throw new Error("No credentials");
  }

  const bucket = metadata.tosStorage?.bucket?.trim() ?? "";
  const region = metadata.tosStorage?.region?.trim() ?? "";
  console.log(
    JSON.stringify(
      {
        bucket,
        tosRegion: region,
        iamRegion: credentials.region,
      },
      null,
      2
    )
  );

  const endTime = Math.floor(Date.now() / 1000);
  const attempts: readonly {
    readonly label: string;
    readonly region: string;
    readonly startOffsetSeconds: number;
    readonly period: string;
  }[] = [
    {
      label: "current-1h-300s-guangzhou",
      region,
      startOffsetSeconds: 3600,
      period: "300s",
    },
    {
      label: "current-24h-3600s-guangzhou",
      region,
      startOffsetSeconds: 86400,
      period: "3600s",
    },
    {
      label: "current-24h-3600s-beijing",
      region: "cn-beijing",
      startOffsetSeconds: 86400,
      period: "3600s",
    },
  ];

  for (const attempt of attempts) {
    console.log(`\n=== ${attempt.label} ===`);
    try {
      const raw = await callVolcengineMonitorApi({
        credentials,
        action: "GetMetricData",
        region: attempt.region,
        body: {
          Namespace: "VCM_TOS",
          SubNamespace: "bucket_overview",
          MetricName: "BucketTotalStorage",
          StartTime: endTime - attempt.startOffsetSeconds,
          EndTime: endTime,
          Period: attempt.period,
          Instances: [
            {
              Dimensions: [{ Name: "ResourceID", Value: bucket }],
            },
          ],
        },
      });
      console.log("OK", JSON.stringify(raw, null, 2));
    } catch (error) {
      console.error(
        "FAIL",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  for (const service of ["volcobserve", "Volc_Observe", "CloudMonitor"] as const) {
    console.log(`\n=== service=${service} region=${region} ===`);
    try {
      const { signVolcengineRequest } = await import(
        "../src/integrations/volcengine/signature"
      );
      const end = Math.floor(Date.now() / 1000);
      const body = {
        Namespace: "VCM_TOS",
        SubNamespace: "bucket_overview",
        MetricName: "BucketTotalStorage",
        StartTime: end - 86400,
        EndTime: end,
        Period: "3600s",
        Instances: [
          { Dimensions: [{ Name: "ResourceID", Value: bucket }] },
        ],
      };
      const signed = await signVolcengineRequest({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region,
        service,
        host: "open.volcengineapi.com",
        method: "POST",
        action: "GetMetricData",
        version: "2018-01-01",
        body,
      });
      const response = await fetch(signed.url, {
        method: "POST",
        headers: signed.headers,
        body: signed.body,
      });
      const text = await response.text();
      console.log("HTTP", response.status, text.slice(0, 800));
    } catch (error) {
      console.error(
        "FAIL",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  try {
    const result = await queryTosBucketStorageGiB({
      credentials,
      bucket,
      region,
    });
    console.log("\n=== queryTosBucketStorageGiB ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      "\n=== queryTosBucketStorageGiB error ===",
      error instanceof Error ? error.message : String(error)
    );
  }
}

void main();
