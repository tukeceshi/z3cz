import type { SystemUpdateStatus } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { fetchLatestGithubRelease } from "../../services/github-latest-release";
import { disconnectedUpdateStatus } from "../../services/system-update-status";

const adminSystemUpdateRoutes = new Hono<ApiContext>();

const startSchema = z.object({
  targetVersion: z.string().trim().min(1).max(64),
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

function compareLoose(current: string, latest: string): boolean {
  const informal = !/^v?\d+\.\d+\.\d+/.test(current);
  if (informal) {
    return true;
  }
  return (
    current.replace(/^v/, "") !== latest.replace(/^v/, "") && latest > current
  );
}

adminSystemUpdateRoutes.get("/", async (c) => {
  try {
    const status = await callUpdater(c.env, "GET", "/v1/status");
    return c.json(status);
  } catch (error) {
    if (error instanceof Error && error.message !== "unsupported") {
      console.warn("Host updater status failed", error);
    }
    return c.json(disconnectedUpdateStatus(c.env));
  }
});

adminSystemUpdateRoutes.post("/check", async (c) => {
  try {
    const status = await callUpdater(c.env, "POST", "/v1/check");
    return c.json(status);
  } catch (error) {
    if (error instanceof Error && error.message !== "unsupported") {
      return c.json({ error: error.message }, 502);
    }
    try {
      const latestRelease = await fetchLatestGithubRelease();
      const currentVersion = c.env.APP_VERSION || "unknown";
      return c.json(
        disconnectedUpdateStatus(c.env, {
          latestRelease,
          updateAvailable: compareLoose(currentVersion, latestRelease.version),
          operation: {
            phase: latestRelease ? "ready" : "no_update",
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
  "/start",
  zValidator("json", startSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const status = await callUpdater(c.env, "POST", "/v1/update", {
        targetVersion: body.targetVersion,
      });
      return c.json(status);
    } catch (error) {
      if (error instanceof Error && error.message === "unsupported") {
        return c.json(
          { error: "当前部署不支持后台在线更新，请先在服务器安装更新器" },
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
          { error: "当前部署不支持后台回退，请先在服务器安装更新器" },
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
