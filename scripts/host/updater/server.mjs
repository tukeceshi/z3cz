import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/**
 * @param {UpdateManager} manager
 * @param {string} token
 */
export function createUpdaterServer(manager, token) {
  if (!token || token.length < 32) {
    throw new Error("更新器 Token 至少 32 个字符");
  }

  const server = http.createServer((request, response) => {
    void handle(request, response, manager, token);
  });
  return server;
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @param {UpdateManager} manager
 * @param {string} token
 */
async function handle(request, response, manager, token) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  const provided = String(request.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!tokensEqual(provided, token)) {
    writeJson(response, 401, { error: "更新器认证失败", data: null });
    return;
  }
  const url = new URL(request.url || "/", "http://unix");
  try {
    if (request.method === "GET" && url.pathname === "/v1/status") {
      writeJson(response, 200, manager.snapshot());
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/check") {
      const status = await manager.check();
      writeJson(response, 200, status);
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/source-channel") {
      const body = await readJson(request);
      const status = manager.setSourceChannel(String(body.sourceChannel || ""));
      writeJson(response, 200, status);
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/update") {
      const body = await readJson(request);
      const status = manager.startUpdate(String(body.targetVersion || ""));
      writeJson(response, 202, status);
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/rollback") {
      const body = await readJson(request);
      const status = manager.startRollback(String(body.reason || ""));
      writeJson(response, 202, status);
      return;
    }
    writeJson(response, 404, { error: "未知接口", data: null });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error
      ? error.status
      : manager.snapshot();
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, 409, { error: message, data: status });
  }
}

function tokensEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * @param {http.IncomingMessage} request
 */
function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("请求过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON 无效"));
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response, status, value) {
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

/**
 * @param {string} socketPath
 * @param {http.Server} server
 */
export function listenUnix(socketPath, server) {
  fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // ignore missing
  }
  return new Promise((resolve, reject) => {
    server.listen({ path: socketPath }, () => {
      try {
        fs.chmodSync(socketPath, 0o660);
      } catch {
        // ignore
      }
      resolve();
    });
    server.on("error", reject);
  });
}
