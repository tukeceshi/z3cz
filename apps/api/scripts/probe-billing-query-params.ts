import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function billingWithQuery(
  body: Record<string, unknown>,
  queryParams: Record<string, string>
): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action: "ListResourcePackages",
    version: "2022-01-01",
    body,
    queryParams,
  });
  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await res.json()) as {
    ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
    Result?: unknown;
  };
  const err = payload.ResponseMetadata?.Error;
  console.log(`query=${JSON.stringify(queryParams)} body=${JSON.stringify(body)}`);
  if (err) console.log(`${err.Code}: ${err.Message}`);
  else console.log(JSON.stringify(payload.Result, null, 2).slice(0, 4000));
}

async function main(): Promise<void> {
  await billingWithQuery(
    { ResourceType: "Package", MaxResults: "10" },
    {}
  );
  await billingWithQuery({}, { ResourceType: "Package", MaxResults: "10" });
  await billingWithQuery(
    { ResourceType: "Package" },
    { MaxResults: "10" }
  );

  // Maybe ark has newer version with ListResourcePackages
  for (const version of ["2024-01-01", "2023-01-01", "2022-01-01"]) {
    try {
      const result = await callVolcengineArkApi<Record<string, unknown>>({
        credentials: {
          accessKeyId: process.env.VOLC_AK!,
          secretAccessKey: process.env.VOLC_SK!,
          region: "cn-beijing",
        },
        action: "ListResourcePackages",
        body: { PageNumber: 1, PageSize: 20 },
        queryParams: { Version: version },
      });
      console.log(`ark version ${version} OK`, JSON.stringify(result).slice(0, 500));
    } catch (error) {
      console.log(
        `ark version ${version}`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

void main();
