/**
 * Probe ListResourcePackages across hosts/services/versions.
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

interface ProbeTarget {
  readonly label: string;
  readonly host: string;
  readonly service: string;
  readonly version: string;
  readonly region: string;
}

const TARGETS: readonly ProbeTarget[] = [
  {
    label: "ark default",
    host: "ark.cn-beijing.volcengineapi.com",
    service: "ark",
    version: "2024-01-01",
    region: "cn-beijing",
  },
  {
    label: "ark 2023-01-01",
    host: "ark.cn-beijing.volcengineapi.com",
    service: "ark",
    version: "2023-01-01",
    region: "cn-beijing",
  },
  {
    label: "billing cn-beijing",
    host: "billing.volcengineapi.com",
    service: "billing",
    version: "2022-01-01",
    region: "cn-beijing",
  },
  {
    label: "volc_billing",
    host: "open.volcengineapi.com",
    service: "volc_billing",
    version: "2022-01-01",
    region: "cn-beijing",
  },
  {
    label: "ark_billing guess",
    host: "ark.cn-beijing.volcengineapi.com",
    service: "ark_billing",
    version: "2024-01-01",
    region: "cn-beijing",
  },
];

async function probeAction(
  target: ProbeTarget,
  action: string,
  body: Record<string, unknown>
): Promise<void> {
  const accessKeyId = process.env.VOLC_AK!.trim();
  const secretAccessKey = process.env.VOLC_SK!.trim();

  const signed = await signVolcengineRequest({
    accessKeyId,
    secretAccessKey,
    region: target.region,
    service: target.service,
    host: target.host,
    method: "POST",
    action,
    version: target.version,
    body,
  });

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  const meta = payload.ResponseMetadata as Record<string, unknown> | undefined;
  const error = meta?.Error as Record<string, unknown> | undefined;
  const result = payload.Result ?? payload;

  if (error) {
    console.log(
      `\n=== FAIL [${target.label}] ${action} ===\n  ${error.Code}: ${error.Message}`
    );
    return;
  }

  console.log(`\n=== OK [${target.label}] ${action} ===`);
  console.log(JSON.stringify(result, null, 2).slice(0, 6000));
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const body = { PageNumber: 1, PageSize: 50 };
  const actions = [
    "ListResourcePackages",
    "ListInferenceResourcePackages",
    "ListArkResourcePackages",
    "ListModelResourcePackages",
  ] as const;

  for (const target of TARGETS) {
    for (const action of actions) {
      await probeAction(target, action, body);
    }
  }

  // Also dump ListAccountQuotas filtered items for reference
  await probeAction(TARGETS[0], "ListAccountQuotas", {
    PageNumber: 1,
    PageSize: 50,
  });
}

void main();
