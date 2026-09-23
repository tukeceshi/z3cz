import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOCKET_PATH = "/run/z3cz-site/site.sock";
const APPLY_ERROR_NAME = "site-address-apply.error";

/**
 * Same rules as normalize_site_address in common.sh.
 * @param {string} raw
 * @returns {string} `:80` or a public hostname
 */
export function normalizeSiteAddress(raw) {
  let value = String(raw ?? "");
  value = value.trim().toLowerCase().replace(/\/+$/, "");
  if (value === "" || value === ":80") {
    return ":80";
  }
  value = value.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\.$/, "");
  if (/[:/?#@\s]/.test(value)) {
    throw siteAddressError("invalid_chars");
  }
  if (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)
  ) {
    throw siteAddressError("local_name");
  }
  if (
    value.length > 253 ||
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(
      value
    )
  ) {
    throw siteAddressError("invalid_domain");
  }
  return value;
}

/**
 * @param {string} content
 * @param {string} siteAddress normalized `:80` or hostname
 */
export function applySiteAddressEnv(content, siteAddress) {
  const kept = String(content)
    .split(/\r?\n/)
    .filter((line) => !/^(Z3CZ_SITE_ADDRESS|WEB_HOST|WEBSITE_URL)=/.test(line));
  while (kept.length > 0 && kept[kept.length - 1] === "") {
    kept.pop();
  }
  kept.push(`Z3CZ_SITE_ADDRESS=${siteAddress}`);
  if (siteAddress !== ":80") {
    const origin = `https://${siteAddress}`;
    kept.push(`WEB_HOST=${origin}`);
    kept.push(`WEBSITE_URL=${origin}`);
  }
  return `${kept.join("\n")}\n`;
}

/**
 * Old installs have no token. Adding one means api must be recreated to see it.
 * @param {string} content
 * @param {() => string} tokenFactory
 */
export function ensureSiteAddressAccess(content, tokenFactory) {
  const hasToken = readEnvValue(content, "Z3CZ_SITE_ADDRESS_TOKEN") !== "";
  const hasSocket = readEnvValue(content, "Z3CZ_SITE_ADDRESS_SOCKET") !== "";
  if (hasToken && hasSocket) {
    return { content, changed: false };
  }
  let next = String(content).replace(/\n*$/, "\n");
  if (!hasToken) {
    next += `Z3CZ_SITE_ADDRESS_TOKEN=${tokenFactory()}\n`;
  }
  if (!hasSocket) {
    next += `Z3CZ_SITE_ADDRESS_SOCKET=${SOCKET_PATH}\n`;
  }
  return { content: next, changed: true };
}

/**
 * @param {string} content
 * @param {string} key
 */
export function readEnvValue(content, key) {
  const prefix = `${key}=`;
  for (const line of String(content).split(/\r?\n/)) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return "";
}

/**
 * @param {string} content
 * @param {string | null} applyError
 */
export function siteAddressStatus(content, applyError) {
  const raw = readEnvValue(content, "Z3CZ_SITE_ADDRESS");
  const siteAddress = raw && raw !== ":80" ? raw : null;
  return {
    siteAddress,
    httpOnly: siteAddress === null,
    applyError: applyError || null,
  };
}

/**
 * @param {string} content
 * @param {string} siteAddress
 */
export function isSiteAddressApplied(content, siteAddress) {
  if (readEnvValue(content, "Z3CZ_SITE_ADDRESS") !== siteAddress) {
    return false;
  }
  if (siteAddress === ":80") {
    return (
      readEnvValue(content, "WEB_HOST") === "" &&
      readEnvValue(content, "WEBSITE_URL") === ""
    );
  }
  const origin = `https://${siteAddress}`;
  return (
    readEnvValue(content, "WEB_HOST") === origin &&
    readEnvValue(content, "WEBSITE_URL") === origin
  );
}

/**
 * @param {object} options
 * @param {string} options.envFile
 * @param {() => string} options.readToken
 * @param {() => string | null} options.readApplyError
 * @param {(message: string | null) => void} options.writeApplyError
 * @param {() => Promise<void>} options.runCompose
 */
export function createSiteAddressServer(options) {
  let applying = false;

  const server = http.createServer((request, response) => {
    void handle(request, response);
  });

  async function handle(request, response) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    const provided = String(request.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!tokensEqual(provided, options.readToken())) {
      writeJson(response, 401, { error: "unauthorized", code: "unauthorized" });
      return;
    }
    const url = new URL(request.url || "/", "http://unix");
    try {
      if (request.method === "GET" && url.pathname === "/v1/site-address") {
        writeJson(
          response,
          200,
          siteAddressStatus(readFile(options.envFile), options.readApplyError())
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/site-address") {
        await apply(request, response);
        return;
      }
      writeJson(response, 404, { error: "not_found", code: "not_found" });
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? String(error.code) : "";
      if (
        code === "invalid_chars" ||
        code === "local_name" ||
        code === "invalid_domain"
      ) {
        writeJson(response, 400, { error: code, code });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      writeJson(response, 500, { error: message, code: "apply_failed" });
    }
  }

  async function apply(request, response) {
    const body = await readJson(request);
    const siteAddress = normalizeSiteAddress(String(body.siteAddress ?? ""));
    if (applying) {
      writeJson(response, 409, { error: "applying", code: "applying" });
      return;
    }
    const current = readFile(options.envFile);
    const publicAddress = siteAddress === ":80" ? null : siteAddress;
    if (isSiteAddressApplied(current, siteAddress)) {
      writeJson(response, 200, {
        accepted: true,
        siteAddress: publicAddress,
        restarting: false,
      });
      return;
    }
    writeFile(options.envFile, applySiteAddressEnv(current, siteAddress));
    options.writeApplyError(null);
    applying = true;
    writeJson(response, 200, {
      accepted: true,
      siteAddress: publicAddress,
      restarting: true,
    });
    try {
      await options.runCompose();
      options.writeApplyError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.writeApplyError(message.slice(0, 500));
    } finally {
      applying = false;
    }
  }

  return server;
}

function siteAddressError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function tokensEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

function writeFile(file, content) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024) {
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

function onHost(hostRoot, absPath) {
  if (!hostRoot) {
    return absPath;
  }
  return path.join(hostRoot, absPath.replace(/^\/+/, ""));
}

function findChroot() {
  for (const candidate of ["/usr/sbin/chroot", "/usr/bin/chroot"]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

/**
 * Recreate api and caddy with the host docker. The node image has no docker CLI,
 * so this chroots into the host root and uses the compose already installed there.
 * @param {object} paths
 * @param {string} paths.hostRoot
 * @param {string} paths.envFile host path
 * @param {string} paths.releaseDir host path
 * @param {string} paths.passwordFile host path
 */
export function runHostCompose(paths) {
  const chroot = findChroot();
  if (!chroot) {
    return Promise.reject(new Error("域名服务找不到 chroot，无法重建站点"));
  }
  const composeFile = path.posix.join(paths.releaseDir, "compose.yml");
  return new Promise((resolve, reject) => {
    const child = spawn(
      chroot,
      [
        paths.hostRoot,
        "docker",
        "compose",
        "--env-file",
        paths.envFile,
        "-f",
        composeFile,
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "api",
        "caddy",
      ],
      {
        env: {
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          HOME: "/root",
          Z3CZ_RELEASE_DIR: paths.releaseDir,
          Z3CZ_ENV_FILE: paths.envFile,
          Z3CZ_POSTGRES_PASSWORD_FILE: paths.passwordFile,
        },
      }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `docker compose 退出码 ${code}`));
    });
  });
}

function start() {
  const hostRoot = process.env.Z3CZ_HOST_ROOT || "";
  const envFile = process.env.Z3CZ_ENV_FILE || "/etc/z3cz/z3cz.env";
  const installDir = process.env.Z3CZ_INSTALL_DIR || "/opt/z3cz";
  const socketPath = process.env.Z3CZ_SITE_ADDRESS_SOCKET || SOCKET_PATH;
  const hostEnvFile = onHost(hostRoot, envFile);
  const applyErrorFile = onHost(
    hostRoot,
    path.posix.join(path.posix.dirname(envFile), APPLY_ERROR_NAME)
  );
  const releaseDir = path.posix.join(installDir, "current");
  const passwordFile = path.posix.join(
    path.posix.dirname(envFile),
    "postgres.password"
  );

  if (!fs.existsSync(hostEnvFile)) {
    throw new Error(`缺少配置文件 ${envFile}`);
  }

  const ensured = ensureSiteAddressAccess(
    fs.readFileSync(hostEnvFile, "utf8"),
    () => crypto.randomBytes(32).toString("hex")
  );
  if (ensured.changed) {
    writeFile(hostEnvFile, ensured.content);
  }

  const token = () =>
    readEnvValue(
      fs.readFileSync(hostEnvFile, "utf8"),
      "Z3CZ_SITE_ADDRESS_TOKEN"
    );
  if (token().length < 32) {
    throw new Error("域名服务 Token 至少 32 个字符");
  }

  fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  try {
    fs.unlinkSync(socketPath);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  const server = createSiteAddressServer({
    envFile: hostEnvFile,
    readToken: token,
    readApplyError: () => {
      try {
        return fs.readFileSync(applyErrorFile, "utf8").trim() || null;
      } catch {
        return null;
      }
    },
    writeApplyError: (message) => {
      if (!message) {
        fs.rmSync(applyErrorFile, { force: true });
        return;
      }
      fs.writeFileSync(applyErrorFile, message, { mode: 0o600 });
    },
    runCompose: () =>
      runHostCompose({
        hostRoot: hostRoot || "/",
        envFile,
        releaseDir,
        passwordFile,
      }),
  });
  server.listen(socketPath, () => {
    fs.chmodSync(socketPath, 0o600);
    console.log(`site address service listening on ${socketPath}`);
  });
  if (ensured.changed) {
    void runHostCompose({
      hostRoot: hostRoot || "/",
      envFile,
      releaseDir,
      passwordFile,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      fs.writeFileSync(applyErrorFile, message.slice(0, 500), { mode: 0o600 });
      console.error(message);
    });
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  start();
}
