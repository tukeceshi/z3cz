import {
  runDatabaseMigrations,
  waitForPostgres,
} from "./env/docker-bootstrap";
import { writeBootPhase } from "./env/api-boot-cache";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";

import { createApp } from "./app";
import type { Bindings } from "./context";
import { createNodeBindings } from "./env/create-node-bindings";
import { registerNodeBootstrapWsRoutes } from "./routes/bootstrap-ws-node";
import { registerNodeWsRoutes } from "./routes/ws-node";
import { handleScheduledEvent } from "./scheduled";

export async function runServer(envVars: Record<string, string>): Promise<void> {
  const databaseUrl =
    envVars.DATABASE_URL ??
    "postgresql://postgres:postgres@supabase-db:5432/postgres";

  await waitForPostgres(databaseUrl);
  runDatabaseMigrations(databaseUrl);

  const port = Number(envVars.PORT ?? 3102);
  const hostname = envVars.HOST ?? "0.0.0.0";
  const wsListenHost = hostname === "0.0.0.0" ? "localhost" : hostname;

  writeBootPhase("creating_bindings");
  const bindings: Bindings = await createNodeBindings(envVars);

  writeBootPhase("creating_app");
  const app = createApp({ runtime: "node" });
  const honoFetch = app.fetch.bind(app);

  const fetchWithBindings = (
    request: Request,
    serverEnv?: { incoming: unknown; outgoing: unknown }
  ): Response | Promise<Response> => {
    if (serverEnv && "incoming" in serverEnv) {
      Object.assign(serverEnv, bindings);
      return honoFetch(
        request,
        serverEnv as Bindings,
        serverEnv as unknown as ExecutionContext
      );
    }
    return honoFetch(request, bindings);
  };

  const wsAwareApp = Object.assign(app, {
    fetch: fetchWithBindings,
    request: (
      input: RequestInfo | URL,
      init?: RequestInit,
      executionCtx?: Record<string, unknown>
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      if (executionCtx && "incoming" in executionCtx) {
        Object.assign(executionCtx, bindings);
        return honoFetch(
          request,
          executionCtx as Bindings,
          executionCtx as unknown as ExecutionContext
        );
      }
      return honoFetch(request, bindings);
    },
  });

  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({
    app: wsAwareApp,
    baseUrl: `http://${wsListenHost}:${port}`,
  });

  registerNodeWsRoutes(app, upgradeWebSocket);
  registerNodeBootstrapWsRoutes(app, upgradeWebSocket);

  writeBootPhase("starting_server");
  const server = serve(
    {
      fetch: fetchWithBindings,
      port,
      hostname,
    },
    (info) => {
      writeBootPhase("listening");
      console.log(
        `[api] Node server listening on http://${hostname}:${info.port}`
      );
      console.log(
        `[api] Object storage: local filesystem (${envVars.LOCAL_STORAGE_PATH})`
      );
      console.log("[api] WebSocket: Node in-memory session hub");
      console.log("[api] Queue: in-process workflow queue");
      console.log("[api] Mailbox: in-memory per-org store");
      console.log("[api] Inbound email: POST /inbound-email");
    }
  );

  injectWebSocket(server);

  if (envVars.ENABLE_SCHEDULED_WORKER !== "false") {
    const runScheduled = () => {
      void handleScheduledEvent(
        {} as ScheduledEvent,
        bindings,
        {} as ExecutionContext
      ).catch((error) => {
        console.error("[api] Scheduled worker failed:", error);
      });
    };
    runScheduled();
    setInterval(runScheduled, 60_000);
  }

  const { runDueTextContentMerges } = await import(
    "./services/text-content-service"
  );
  setInterval(() => {
    void runDueTextContentMerges(bindings).catch((error) => {
      console.error("[api] Text content merge worker failed:", error);
    });
  }, 30_000);
}
