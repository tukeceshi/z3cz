import type { SystemUpdateStatus } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { compareVersions } from "../../../../../packages/utils/src/release-version.mjs";

import { ApiContext } from "../../context";
import { fetchLatestGithubRelease } from "../../services/github-latest-release";
import { disconnectedUpdateStatus } from "../../services/system-update-status";
import type {
  SystemUpdateSourceChannel,
  SystemUpdateOperation,
} from "@dafthunk/types";

const adminSystemUpdateRoutes = new Hono<ApiContext>();
const DEFAULT_UPDATE_ROOT = "/var/lib/z3cz/update";
let preparationRunning = false;

async function preparation(env: ApiContext["Bindings"]) {
  const { createPreparationStore } = await import(
    "../../services/system-update-preparer-node"
  );
  const root = env.UPDATE_STATE_DIR?.trim() || DEFAULT_UPDATE_ROOT;
  return { root, store: createPreparationStore(root) };
}

async function readAdminSource(
  env: ApiContext["Bindings"]
): Promise<SystemUpdateSourceChannel> {
  if (env.RUNTIME !== "node") return "github";
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { root } = await preparation(env);
  try {
    const value = fs
      .readFileSync(path.join(root, "source-channel"), "utf8")
      .trim();
    return value === "gitee" ? "gitee" : "github";
  } catch {
    return "github";
  }
}

async function writeAdminSource(
  env: ApiContext["Bindings"],
  value: SystemUpdateSourceChannel
) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { root } = await preparation(env);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "source-channel"), `${value}\n`, {
    mode: 0o600,
  });
}

function preparationIsActive(operation?: SystemUpdateOperation) {
  return Boolean(
    operation &&
      ["downloading", "verifying_download", "extracting", "preparing"].includes(
        operation.phase
      )
  );
}

function visibleOperation(
  prepared: SystemUpdateOperation | undefined,
  runner: SystemUpdateOperation
) {
  if (!prepared) return runner;
  if (preparationIsActive(prepared)) return prepared;
  if (
    prepared.phase === "failed" &&
    Date.parse(prepared.startedAt || "") >= Date.parse(runner.startedAt || "")
  ) {
    return prepared;
  }
  return runner;
}

const startSchema = z.object({
  targetVersion: z.string().trim().min(1).max(64),
});

const sourceChannelSchema = z.object({
  sourceChannel: z.enum(["github", "gitee"]),
});

const rollbackSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});

async function callUpdater(
  env: ApiContext["Bindings"],
  method: "GET" | "POST",
  pathname: string,
  body?: Record<string, string>
): Promise<SystemUpdateStatus> {
  const socket = env.UPDATER_SOCKET?.trim();
  const token = env.UPDATER_TOKEN?.trim();
  if (env.RUNTIME !== "node" || !socket || !token) {
    throw new Error("unsupported");
  }
  const { requestHostUpdater } = await import(
    "../../services/host-updater-client-node"
  );
  return requestHostUpdater(socket, token, method, pathname, body);
}

adminSystemUpdateRoutes.get("/", async (c) => {
  try {
    const [status, source, prepared] = await Promise.all([
      callUpdater(c.env, "GET", "/v1/status"),
      readAdminSource(c.env),
      preparation(c.env).then(({ store }) => store.read()),
    ]);
    let recovered = prepared;
    if (prepared && preparationIsActive(prepared) && !preparationRunning) {
      recovered = {
        ...prepared,
        phase: "failed",
        error: "更新包准备因后台重启而中断，请重新开始更新",
        finishedAt: new Date().toISOString(),
        logs: [
          ...prepared.logs,
          {
            at: new Date().toISOString(),
            phase: "failed" as const,
            message: "更新包准备因后台重启而中断",
          },
        ].slice(-120),
      };
      const { store } = await preparation(c.env);
      store.write(recovered);
    }
    return c.json({
      ...status,
      sourceChannel: source,
      operation: visibleOperation(recovered, status.operation),
    });
  } catch (error) {
    if (error instanceof Error && error.message !== "unsupported") {
      console.warn("Host updater status failed", error);
    }
    return c.json(disconnectedUpdateStatus(c.env));
  }
});

adminSystemUpdateRoutes.post("/check", async (c) => {
  try {
    const [status, latestRelease, sourceChannel] = await Promise.all([
      callUpdater(c.env, "GET", "/v1/status"),
      fetchLatestGithubRelease(),
      readAdminSource(c.env),
    ]);
    const updateAvailable =
      compareVersions(status.currentVersion, latestRelease.version) < 0;
    return c.json({
      ...status,
      sourceChannel,
      latestRelease,
      updateAvailable,
      checkedAt: new Date().toISOString(),
      stale: false,
      operation: {
        ...status.operation,
        phase: updateAvailable ? "ready" : "no_update",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message !== "unsupported") {
      return c.json({ error: error.message }, 502);
    }
    try {
      const latestRelease = await fetchLatestGithubRelease();
      const currentVersion = c.env.APP_VERSION || "unknown";
      const updateAvailable =
        compareVersions(currentVersion, latestRelease.version) < 0;
      return c.json(
        disconnectedUpdateStatus(c.env, {
          latestRelease,
          updateAvailable,
          checkedAt: new Date().toISOString(),
          stale: false,
          operation: {
            phase: updateAvailable ? "ready" : "no_update",
            automaticRollback: false,
            logs: [],
          },
        })
      );
    } catch (checkError) {
      return c.json(
        {
          error:
            checkError instanceof Error ? checkError.message : "检查更新失败",
        },
        502
      );
    }
  }
});

adminSystemUpdateRoutes.post(
  "/source-channel",
  zValidator("json", sourceChannelSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      await writeAdminSource(c.env, body.sourceChannel);
      const status = await callUpdater(c.env, "GET", "/v1/status");
      return c.json({ ...status, sourceChannel: body.sourceChannel });
    } catch (error) {
      if (error instanceof Error && error.message === "unsupported") {
        return c.json(
          {
            error: "当前部署不支持后台在线更新，请先完成自托管部署以安装更新器",
          },
          409
        );
      }
      const status = (error as Error & { status?: SystemUpdateStatus }).status;
      return c.json(
        {
          error: error instanceof Error ? error.message : "无法保存下载渠道",
          data: status,
        },
        409
      );
    }
  }
);

adminSystemUpdateRoutes.post(
  "/start",
  zValidator("json", startSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const status = await callUpdater(c.env, "GET", "/v1/status");
      if (
        [
          "preflight",
          "backing_up",
          "draining",
          "migrating",
          "switching",
          "verifying",
          "rolling_back",
        ].includes(status.operation.phase)
      ) {
        return c.json({ error: "已有宿主机更新事务正在执行" }, 409);
      }
      const source = await readAdminSource(c.env);
      const { root, store } = await preparation(c.env);
      if (preparationIsActive(store.read()))
        return c.json({ error: "更新包正在准备中" }, 409);
      const { prepareSystemUpdate } = await import(
        "../../services/system-update-preparer-node"
      );
      preparationRunning = true;
      void prepareSystemUpdate({
        repository: "tukeceshi/z3cz",
        source,
        version: body.targetVersion,
        root,
        store,
      })
        .then(async (prepared) => {
          const next = await callUpdater(c.env, "POST", "/v1/prepared-update", {
            targetVersion: prepared.version,
            archivePath: prepared.archivePath,
            checksum: prepared.checksum,
          });
          const current = store.read();
          if (current)
            store.write({
              ...current,
              phase: "preflight",
              logs: [
                ...current.logs,
                {
                  at: new Date().toISOString(),
                  phase: "preflight" as const,
                  message: "更新包已移交宿主机执行器",
                },
              ].slice(-120),
            });
          return next;
        })
        .catch(async (error) => {
          const current = store.read();
          if (!current) return;
          const message =
            error instanceof Error ? error.message : String(error);
          store.write({
            ...current,
            phase: "failed",
            error: message,
            finishedAt: new Date().toISOString(),
            logs: [
              ...current.logs,
              {
                at: new Date().toISOString(),
                phase: "failed" as const,
                message,
              },
            ].slice(-120),
          });
        })
        .finally(() => {
          preparationRunning = false;
        });
      return c.json({
        ...status,
        sourceChannel: source,
        operation: {
          phase: "downloading",
          targetVersion: body.targetVersion,
          startedAt: new Date().toISOString(),
          automaticRollback: false,
          progress: 0,
          logs: [],
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "unsupported") {
        return c.json(
          {
            error: "当前部署不支持后台在线更新，请先完成自托管部署以安装更新器",
          },
          409
        );
      }
      const status = (error as Error & { status?: SystemUpdateStatus }).status;
      return c.json(
        {
          error: error instanceof Error ? error.message : "无法开始更新",
          data: status,
        },
        409
      );
    }
  }
);

adminSystemUpdateRoutes.post(
  "/rollback",
  zValidator("json", rollbackSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const status = await callUpdater(c.env, "POST", "/v1/rollback", {
        reason: body.reason,
      });
      return c.json(status);
    } catch (error) {
      if (error instanceof Error && error.message === "unsupported") {
        return c.json(
          { error: "当前部署不支持后台回退，请先完成自托管部署以安装更新器" },
          409
        );
      }
      const status = (error as Error & { status?: SystemUpdateStatus }).status;
      return c.json(
        {
          error: error instanceof Error ? error.message : "无法回退",
          data: status,
        },
        409
      );
    }
  }
);

export default adminSystemUpdateRoutes;
