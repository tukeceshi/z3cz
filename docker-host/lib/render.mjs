import fs from "node:fs";
import path from "node:path";

import { parseAppYml } from "./parse-app-yml.mjs";
import {
  appYmlPath,
  dockerHostRoot,
  ensureHostDirs,
  generatedCaddyfilePath,
  generatedComposePath,
  generatedEnvPath,
  repoRoot,
} from "./paths.mjs";
import { isPlaceholderSecret } from "./secrets.mjs";

/**
 * @param {string} hostname
 * @param {boolean} https
 * @param {number} httpPort
 * @param {number} httpsPort
 */
export function publicOrigin(hostname, https, httpPort = 80, httpsPort = 443) {
  if (https) {
    if (httpsPort !== 443) {
      return `https://${hostname}:${httpsPort}`;
    }
    return `https://${hostname}`;
  }
  if (httpPort !== 80) {
    return `http://${hostname}:${httpPort}`;
  }
  return `http://${hostname}`;
}

/**
 * @returns {ReturnType<typeof parseAppYml> & { origin: string }}
 */
export function loadAppConfig() {
  if (!fs.existsSync(appYmlPath)) {
    throw new Error(
      `Missing ${path.relative(repoRoot, appYmlPath)}. Run: docker-host/dafthunk-setup`
    );
  }
  const config = parseAppYml(fs.readFileSync(appYmlPath, "utf8"));
  for (const key of ["JWT_SECRET", "SECRET_MASTER_KEY"]) {
    if (isPlaceholderSecret(config.env[key])) {
      throw new Error(
        `containers/app.yml: ${key} is still a placeholder. Re-run dafthunk-setup.`
      );
    }
  }
  const origin =
    config.env.WEB_HOST?.trim() ||
    publicOrigin(
      config.hostname,
      config.https,
      config.http_port,
      config.https_port
    );
  return {
    ...config,
    origin,
  };
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
function usesFileTls(config) {
  return config.tls === "fallback" || config.tls === "manual";
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
function tlsDirective(config) {
  if (!usesFileTls(config)) {
    return "";
  }
  const base = `/etc/caddy/certs/${config.hostname}`;
  return `\ttls ${base}/fullchain.pem ${base}/privkey.pem\n`;
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
function caddyExtraVolumes(config) {
  if (!usesFileTls(config)) {
    return "";
  }
  return "      - ./shared/caddy/certs:/etc/caddy/certs:ro\n";
}

/**
 * Global Caddy options. HTTP/3 (QUIC/UDP) is disabled by default: on some
 * mainland routes UDP is throttled and browsers stall before falling back to H2.
 *
 * @param {ReturnType<typeof loadAppConfig>} config
 */
function renderCaddyGlobal(config) {
  const lines = ["servers {", "\tprotocols h1 h2", "}"];
  if (config.le_email) {
    lines.unshift(`email ${config.le_email}`);
  }
  return `{\n\t${lines.join("\n\t")}\n}\n\n`;
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
export function renderCaddyfile(config) {
  const siteHandler = `	encode gzip zstd
	route {
	@maintenance file {
		root /maintenance
		try_files enabled
	}
	respond @maintenance "系统正在更新，请稍后刷新。" 503

	handle_path /api/* {
		reverse_proxy api:3001
	}
	handle {
		reverse_proxy app:80 {
			flush_interval -1
		}
	}
	}`;

  if (config.https) {
    const global = renderCaddyGlobal(config);
    const tls = tlsDirective(config);
    return `${global}${config.hostname} {
${tls}\theader Alt-Svc "clear"

${siteHandler}
}
`;
  }

  // HTTP-only: listen on :80 in-container; host maps http_port → 80
  return `:80 {
${siteHandler}
}
`;
}

export const PACKAGED_API_IMAGE = "tukeceshi/z3cz-api";
export const PACKAGED_APP_IMAGE = "tukeceshi/z3cz-app";
export const UPDATER_SOCKET_DIR = "/run/z3cz-updater";

/**
 * @param {string | undefined} imageTag
 */
export function dockerImageTag(imageTag) {
  const value = String(imageTag ?? "latest").trim() || "latest";
  return value.startsWith("v") || value.startsWith("V")
    ? value.slice(1)
    : value;
}

/**
 * @param {string} image
 * @param {string} tag
 */
function withImageTag(image, tag) {
  const name = image.replace(/:[^:/]+$/, "");
  return `${name}:${tag}`;
}

function readPackagedImageNames() {
  const file = path.join(dockerHostRoot, "packaged-images.env");
  let api = PACKAGED_API_IMAGE;
  let app = PACKAGED_APP_IMAGE;
  if (!fs.existsSync(file)) {
    return { api, app };
  }
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("API_IMAGE=")) {
      const value = line.slice("API_IMAGE=".length).trim();
      if (value) {
        api = value.replace(/:[^:/]+$/, "");
      }
    }
    if (line.startsWith("APP_IMAGE=")) {
      const value = line.slice("APP_IMAGE=".length).trim();
      if (value) {
        app = value.replace(/:[^:/]+$/, "");
      }
    }
  }
  return { api, app };
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
export function resolveAppImages(config) {
  const names = readPackagedImageNames();
  const tag = dockerImageTag(config.image_tag);
  return {
    api: withImageTag(names.api, tag),
    app: withImageTag(names.app, tag),
    tag,
  };
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
export function renderCompose(config, source = null) {
  const origin = config.origin.replace(/\/$/, "");
  const staticConf = "../docker/nginx/app.static.conf";
  const images = resolveAppImages(config);
  const mountedSource = source && source.kind !== "image";
  if (source) {
    images.api = source.runtimeImage;
    images.app = source.appImage;
  }
  const sourceApi = mountedSource
    ? `\n    working_dir: /app/apps/api\n    command: ["pnpm", "exec", "tsx", "--import", "./src/shims/cloudflare-register.mjs", "src/server.ts"]`
    : "";
  const sourceVolume = mountedSource
    ? `\n      - ${JSON.stringify(`${source.sourceDir}:/app:ro`)}`
    : "";
  const sourceAppVolume = mountedSource
    ? `\n      - ${JSON.stringify(`${source.sourceDir}/apps/app/dist:/usr/share/nginx/html:ro`)}`
    : "";
  const updaterEnabled = Boolean(config.env.UPDATER_TOKEN?.trim());
  const appVersion =
    images.tag === "latest" ? "latest" : `v${images.tag.replace(/^v/i, "")}`;
  const updaterEnv = updaterEnabled
    ? `
      UPDATER_SOCKET: ${UPDATER_SOCKET_DIR}/updater.sock
      UPDATER_TOKEN: \${UPDATER_TOKEN}`
    : "";
  const updaterVolume = updaterEnabled
    ? `\n      - ${UPDATER_SOCKET_DIR}:${UPDATER_SOCKET_DIR}`
    : "";

  return `# Generated by docker-host/launcher — do not edit
name: dafthunk-host

services:
  postgres:
    image: postgres:16-alpine
    pull_policy: missing
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - ./shared/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 90s
    restart: unless-stopped

  api:
    image: ${images.api}
    pull_policy: ${source ? "never" : "missing"}${sourceApi}
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      RUNTIME: docker
      HOST: 0.0.0.0
      PORT: "3001"
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres
      LOCAL_STORAGE_PATH: /app/data/storage
      API_BOOT_CACHE_DIR: /app/data/storage/cache
      RUN_DB_MIGRATE: "false"
      BOOTSTRAP_ASSETS_DIR: ${mountedSource ? "/app/apps/app/dist" : source?.kind === "image" ? "/app/bootstrap" : "/app/data/bootstrap"}
      Z3CZ_MAINTENANCE_FILE: /maintenance/enabled
      APP_VERSION: "${appVersion}"
      WEB_HOST: "${origin}"
      WEBSITE_URL: "${origin}"
      JWT_SECRET: \${JWT_SECRET}
      SECRET_MASTER_KEY: \${SECRET_MASTER_KEY}
      EMAIL_DOMAIN: \${EMAIL_DOMAIN:-mail.dafthunk.com}
      CLOUDFLARE_ACCOUNT_ID: \${CLOUDFLARE_ACCOUNT_ID:-}
      CLOUDFLARE_API_TOKEN: \${CLOUDFLARE_API_TOKEN:-}
      CLOUDFLARE_ENV: production${updaterEnv}
    volumes:
      - ./shared/storage:/app/data/storage${updaterVolume}${sourceVolume}
      - ./shared/maintenance:/maintenance:ro
    healthcheck:
      test:
        [
          "CMD-SHELL",
          ${JSON.stringify("node -e \"fetch('http://127.0.0.1:3001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"")},
        ]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: ${source ? "180s" : "60s"}
    restart: unless-stopped

  app:
    image: ${images.app}
    pull_policy: ${source ? "never" : "missing"}
    depends_on:
      api:
        condition: service_healthy
    volumes:
      - ${staticConf}:/etc/nginx/conf.d/default.conf:ro${sourceAppVolume}
    restart: unless-stopped

  caddy:
    image: caddy:2.9-alpine
    pull_policy: missing
    depends_on:
      - app
      - api
    ports:
      - "\${HTTP_PORT:-${config.http_port}}:80"
      - "\${HTTPS_PORT:-${config.https_port}}:443"
    volumes:
      - ./Caddyfile.generated:/etc/caddy/Caddyfile:ro
      - ./shared/caddy:/data
      - ./shared/caddy-config:/config
      - ./shared/maintenance:/maintenance:ro
${caddyExtraVolumes(config)}    restart: unless-stopped
`;
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
export function renderEnvFile(config) {
  const lines = [
    "# Generated by docker-host/launcher — do not commit",
    `JWT_SECRET=${config.env.JWT_SECRET}`,
    `SECRET_MASTER_KEY=${config.env.SECRET_MASTER_KEY}`,
    `HTTP_PORT=${config.http_port}`,
    `HTTPS_PORT=${config.https_port}`,
    `IMAGE_TAG=${dockerImageTag(config.image_tag)}`,
    `EMAIL_DOMAIN=${config.env.EMAIL_DOMAIN || "mail.dafthunk.com"}`,
    `CLOUDFLARE_ACCOUNT_ID=${config.env.CLOUDFLARE_ACCOUNT_ID || ""}`,
    `CLOUDFLARE_API_TOKEN=${config.env.CLOUDFLARE_API_TOKEN || ""}`,
  ];
  if (config.env.UPDATER_TOKEN?.trim()) {
    lines.push(`UPDATER_TOKEN=${config.env.UPDATER_TOKEN.trim()}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof loadAppConfig>} config
 */
function writePackagedImagesEnv(config) {
  const images = resolveAppImages(config);
  fs.writeFileSync(
    path.join(dockerHostRoot, "packaged-images.env"),
    `API_IMAGE=${images.api}\nAPP_IMAGE=${images.app}\n`,
    "utf8"
  );
}

export function writeGeneratedFiles() {
  ensureHostDirs();
  fs.mkdirSync(path.join(dockerHostRoot, "shared", "caddy-config"), {
    recursive: true,
  });
  const config = loadAppConfig();
  const sourceFile = path.join(dockerHostRoot, "source-deployment.json");
  const source = fs.existsSync(sourceFile)
    ? JSON.parse(fs.readFileSync(sourceFile, "utf8"))
    : null;
  fs.writeFileSync(generatedCaddyfilePath, renderCaddyfile(config), "utf8");
  fs.writeFileSync(generatedComposePath, renderCompose(config, source), "utf8");
  fs.writeFileSync(generatedEnvPath, renderEnvFile(config), "utf8");
  writePackagedImagesEnv(config);
  return config;
}
