/**
 * Probe billing/commerce hosts for ListResourcePackages.
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

const HOSTS = [
  { host: "billing.volcengineapi.com", service: "billing", version: "2022-01-01" },
  { host: "billing.cn-beijing.volcengineapi.com", service: "billing", version: "2022-01-01" },
  { host: "open.volcengineapi.com", service: "billing", version: "2022-01-01" },
  { host: "open.volcengineapi.com", service: "volc_trade", version: "2020-01-01" },
  { host: "open.volcengineapi.com", service: "volc_billing", version: "2022-01-01" },
  { host: "commerce.volcengineapi.com", service: "commerce", version: "2022-01-01" },
] as const;

async function probe(
  host: string,
  service: string,
  version: string,
  action: string,
  body: Record<string, unknown>
): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service,
    host,
    method: "POST",
    action,
    version,
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
  if (error) {
    if (
      String(error.Code) !== "InvalidActionOrVersion" &&
      String(error.Code) !== "ServiceNotFound"
    ) {
      console.log(`INTERESTING [${host}/${service}] ${action}: ${error.Code} ${error.Message}`);
    }
    return;
  }
  console.log(`OK [${host}/${service}] ${action}`);
  console.log(JSON.stringify(payload.Result ?? payload, null, 2).slice(0, 3000));
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const body = { PageNumber: 1, PageSize: 50, Product: "ark" };
  const actions = [
    "ListResourcePackages",
    "ListInstancePackages",
    "ListPrepaidResourcePackages",
    "ListPostpaidResourcePackages",
    "ListResourcePackageInstances",
    "ListAccountResourcePackages",
  ] as const;

  for (const target of HOSTS) {
    for (const action of actions) {
      await probe(target.host, target.service, target.version, action, body);
    }
  }
}

void main();
