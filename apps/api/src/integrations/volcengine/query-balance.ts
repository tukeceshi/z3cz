import type { VolcanoSnapshotResponse } from "@dafthunk/types";

import type { VolcengineCredentials } from "./client";
import { callVolcengineBillingApi } from "./billing-client";

interface QueryBalanceAcctResult {
  readonly AvailableBalance?: string;
  readonly CashBalance?: string;
}

export async function queryVolcanoBalance(params: {
  credentials: VolcengineCredentials;
}): Promise<VolcanoSnapshotResponse["balance"]> {
  const result = await callVolcengineBillingApi<QueryBalanceAcctResult>({
    credentials: params.credentials,
    action: "QueryBalanceAcct",
    body: {},
  });

  const available = result.AvailableBalance?.trim();
  const cash = result.CashBalance?.trim();
  if (!available && !cash) {
    return null;
  }

  return {
    available: available ?? "0",
    cash: cash ?? "0",
    currency: "CNY",
  };
}
