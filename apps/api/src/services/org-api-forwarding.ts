import { and, eq } from "drizzle-orm";
import { PERSIST_WORKER_FORWARD_PORT } from "@dafthunk/types";
import {
  runWithUpstreamFetch,
  type UpstreamFetch,
} from "@dafthunk/runtime/ai-interface/upstream-request-log";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { pickOrgApiForwardWorker } from "../db/persist-worker-queries";
import { organizationAiInterfaces } from "../db/schema";
import {
  derivePersistWorkerForwardHmacKey,
  signPersistWorkerForwardRequest,
} from "./persist-worker-forward-crypto";

export async function isOrgInterfaceApiForwardingEnabled(
  db: Database,
  organizationId: string,
  aiInterfaceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: organizationAiInterfaces.apiForwardingEnabled })
    .from(organizationAiInterfaces)
    .where(
      and(
        eq(organizationAiInterfaces.id, aiInterfaceId),
        eq(organizationAiInterfaces.organizationId, organizationId)
      )
    )
    .limit(1);

  return Boolean(row?.enabled);
}

async function fetchViaForwardWorker(
  host: string,
  hmacKey: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const timestampMs = Date.now();
  const signature = signPersistWorkerForwardRequest({
    hmacKey,
    timestampMs,
    method,
    url,
  });

  const headers = new Headers(init?.headers);
  headers.set("X-Forward-Url", url);
  headers.set("X-Forward-Method", method);
  headers.set("X-Forward-Ts", String(timestampMs));
  headers.set("X-Forward-Sig", signature);

  const requestInit: RequestInit = {
    method: "POST",
    headers,
    body: init?.body,
    signal: init?.signal,
    ...(init?.body ? { duplex: "half" } : {}),
  } as RequestInit;

  return fetch(`http://${host}:${PERSIST_WORKER_FORWARD_PORT}/forward`, requestInit);
}

export async function createOrgApiForwardFetch(params: {
  readonly db: Database;
  readonly env: Bindings;
  readonly organizationId: string;
  readonly aiInterfaceId: string;
}): Promise<UpstreamFetch | null> {
  const enabled = await isOrgInterfaceApiForwardingEnabled(
    params.db,
    params.organizationId,
    params.aiInterfaceId
  );
  if (!enabled) {
    return null;
  }

  const worker = await pickOrgApiForwardWorker(
    params.db,
    params.organizationId
  );
  if (!worker) {
    return null;
  }

  const hmacKey = derivePersistWorkerForwardHmacKey(params.env.JWT_SECRET);

  return async (url, init) => {
    try {
      return await fetchViaForwardWorker(worker.host, hmacKey, url, init);
    } catch {
      return fetch(url, init);
    }
  };
}

export async function withOrgApiForwarding<T>(
  params: {
    readonly db: Database;
    readonly env: Bindings;
    readonly organizationId: string;
    readonly aiInterfaceId: string;
  },
  fn: () => T
): Promise<Awaited<T>> {
  const fetchImpl = await createOrgApiForwardFetch(params);
  if (!fetchImpl) {
    return await fn();
  }
  return await runWithUpstreamFetch(fetchImpl, fn);
}
