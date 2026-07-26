import type { ApiContext } from "../context";

/** Count executions for an organization from Cloudflare Analytics Engine. */
export async function fetchAdminOrganizationExecutionCount(
  env: ApiContext["Bindings"],
  organizationId: string
): Promise<number> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return 0;
  }

  const dataset =
    (env.CLOUDFLARE_ENV || "development") === "production"
      ? "dafthunk_executions_production"
      : "dafthunk_executions_development";

  const aeSql = `
    SELECT COUNT() AS count
    FROM ${dataset}
    WHERE index1 = '${organizationId}'
  `;

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    body: aeSql,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(
      `Admin execution count query failed: ${response.status} - ${error}`
    );
    return 0;
  }

  const result = (await response.json()) as {
    data?: Array<{ count: number }>;
  };
  return Number(result.data?.[0]?.count ?? 0);
}
