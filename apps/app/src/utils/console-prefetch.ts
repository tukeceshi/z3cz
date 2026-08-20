import type {
  BootstrapConfigResponse,
  BootstrapPrefetchPackConfig,
  BootstrapShellSource,
  BootstrapStaticAssetConfig,
} from "@dafthunk/types";

const ASSETS_CACHE_NAME = "z3cz-bootstrap-assets:v1";
const ASSET_SW_URL = "/z3cz-asset-sw.js";
const API_BASE = "/api";
const FETCH_TIMEOUT_MS = 30000;
const SW_CONTROL_TIMEOUT_MS = 5000;

interface ShellFileEntry {
  readonly path: string;
  readonly size: number;
}

interface ShellHeader {
  readonly version: 1;
  readonly entry: string;
  readonly css: readonly string[];
  readonly files: readonly ShellFileEntry[];
}

type PackStatus = "idle" | "downloading" | "ready" | "failed";

interface PackRuntimeState {
  readonly config: BootstrapPrefetchPackConfig;
  status: PackStatus;
  promise: Promise<void> | null;
}

let bootstrapConfig: BootstrapConfigResponse | null = null;
let bootstrapConfigPromise: Promise<BootstrapConfigResponse | null> | null =
  null;
let serviceWorkerReady = false;
let serviceWorkerPromise: Promise<boolean> | null = null;
const packStates = new Map<string, PackRuntimeState>();

function isPrefetchActive(): boolean {
  return import.meta.env.PROD;
}

async function fetchBootstrapConfig(): Promise<BootstrapConfigResponse | null> {
  if (bootstrapConfig) {
    return bootstrapConfig;
  }
  if (bootstrapConfigPromise) {
    return bootstrapConfigPromise;
  }

  bootstrapConfigPromise = fetch(`${API_BASE}/bootstrap/config`, {
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      const config = (await response.json()) as BootstrapConfigResponse;
      bootstrapConfig = config;
      for (const pack of config.prefetchPacks ?? []) {
        if (!packStates.has(pack.id)) {
          packStates.set(pack.id, {
            config: pack,
            status: "idle",
            promise: null,
          });
        }
      }
      return config;
    })
    .catch(() => null)
    .finally(() => {
      bootstrapConfigPromise = null;
    });

  return bootstrapConfigPromise;
}

function waitForServiceWorkerControl(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve(false);
  }
  if (navigator.serviceWorker.controller) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (active: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(active);
    };

    const timer = globalThis.setTimeout(() => {
      finish(Boolean(navigator.serviceWorker.controller));
    }, SW_CONTROL_TIMEOUT_MS);

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      function onChange() {
        globalThis.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onChange
        );
        finish(true);
      }
    );
  });
}

async function ensureAssetServiceWorker(): Promise<boolean> {
  if (serviceWorkerReady) {
    return true;
  }
  if (serviceWorkerPromise) {
    return serviceWorkerPromise;
  }

  serviceWorkerPromise = (async () => {
    if (!("serviceWorker" in navigator)) {
      return false;
    }
    try {
      await navigator.serviceWorker.register(ASSET_SW_URL);
      const ready = await waitForServiceWorkerControl();
      serviceWorkerReady = ready;
      return ready;
    } catch {
      return false;
    } finally {
      serviceWorkerPromise = null;
    }
  })();

  return serviceWorkerPromise;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const onAbort = () => {
    controller.abort();
  };
  externalSignal?.addEventListener("abort", onAbort);
  if (externalSignal?.aborted) {
    controller.abort();
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}

async function digestHash(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "";
  }
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function fetchBufferFromSources(
  sources: readonly BootstrapShellSource[],
  expectedHash: string,
  label: string
): Promise<ArrayBuffer> {
  const resolvedSources =
    sources.length > 0 ? sources : [{ url: label, kind: "origin" as const }];

  const download = async (
    source: BootstrapShellSource,
    signal?: AbortSignal
  ): Promise<ArrayBuffer> => {
    const response = await fetchWithTimeout(
      source.url,
      {
        credentials: source.url.startsWith("http") ? "omit" : "same-origin",
        cache: "no-store",
        mode: source.url.startsWith("http") ? "cors" : "same-origin",
        signal,
      },
      FETCH_TIMEOUT_MS
    );
    if (!response.ok) {
      throw new Error(`Prefetch download failed for ${label}`);
    }
    const buffer = await response.arrayBuffer();
    if (expectedHash) {
      const actual = await digestHash(buffer);
      if (actual && actual !== expectedHash) {
        throw new Error(`Prefetch hash mismatch for ${label}`);
      }
    }
    return buffer;
  };

  if (resolvedSources.length === 1) {
    return download(resolvedSources[0]);
  }

  const controllers = resolvedSources.map(() => new AbortController());
  const attempts = resolvedSources.map(async (source, index) => {
    const buffer = await download(source, controllers[index].signal);
    controllers.forEach((controller, controllerIndex) => {
      if (controllerIndex !== index) {
        controller.abort();
      }
    });
    return buffer;
  });

  return Promise.any(attempts);
}

async function fetchPackBuffer(
  pack: BootstrapPrefetchPackConfig
): Promise<ArrayBuffer> {
  const sources =
    pack.sources.length > 0
      ? pack.sources
      : [{ url: pack.path, kind: "origin" as const }];
  return fetchBufferFromSources(sources, pack.hash, pack.id);
}

async function gunzipBytes(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Gzip decompression unavailable");
  }
  return new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();
}

function contentTypeForAssetPath(path: string): string {
  if (path.endsWith(".js")) {
    return "application/javascript";
  }
  if (path.endsWith(".css")) {
    return "text/css";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".mp4")) {
    return "video/mp4";
  }
  return "application/octet-stream";
}

function parseShellArchive(raw: ArrayBuffer): Record<string, Uint8Array> {
  const bytes = new Uint8Array(raw);
  if (bytes.byteLength < 4) {
    throw new Error("Invalid prefetch archive");
  }

  const headerLength =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const headerStart = 4;
  const headerEnd = headerStart + headerLength;
  if (headerEnd > bytes.byteLength) {
    throw new Error("Invalid prefetch header");
  }

  const headerText = new TextDecoder().decode(
    bytes.subarray(headerStart, headerEnd)
  );
  const header = JSON.parse(headerText) as ShellHeader;
  if (!header || !Array.isArray(header.files)) {
    throw new Error("Invalid prefetch manifest");
  }

  const fileBytes: Record<string, Uint8Array> = {};
  let offset = headerEnd;
  for (const file of header.files) {
    if (offset + file.size > bytes.byteLength) {
      throw new Error("Prefetch archive truncated");
    }
    fileBytes[file.path] = bytes.subarray(offset, offset + file.size);
    offset += file.size;
  }

  return fileBytes;
}

async function seedAssetCache(
  fileBytes: Record<string, Uint8Array>
): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }

  const cache = await caches.open(ASSETS_CACHE_NAME);
  await Promise.all(
    Object.entries(fileBytes).map(([assetPath, bytes]) =>
      cache.put(
        assetPath,
        new Response(bytes, {
          headers: { "Content-Type": contentTypeForAssetPath(assetPath) },
        })
      )
    )
  );
}

async function downloadAndSeedPack(
  pack: BootstrapPrefetchPackConfig
): Promise<void> {
  await ensureAssetServiceWorker();
  const compressed = await fetchPackBuffer(pack);
  const raw = await gunzipBytes(compressed);
  const fileBytes = parseShellArchive(raw);
  await seedAssetCache(fileBytes);
}

function startPrefetchPack(packId: string): Promise<void> {
  const state = packStates.get(packId);
  if (!state) {
    return Promise.resolve();
  }

  if (state.status === "failed") {
    state.status = "idle";
    state.promise = null;
  }

  if (state.status === "ready") {
    return Promise.resolve();
  }

  if (state.promise) {
    return state.promise;
  }

  state.status = "downloading";
  state.promise = downloadAndSeedPack(state.config)
    .then(() => {
      state.status = "ready";
    })
    .catch(() => {
      state.status = "failed";
      state.promise = null;
      throw new Error(`Failed to prefetch pack "${packId}"`);
    });

  return state.promise;
}

async function downloadAndSeedStaticAsset(
  asset: BootstrapStaticAssetConfig
): Promise<void> {
  const sources =
    asset.sources.length > 0
      ? asset.sources
      : [{ url: asset.path, kind: "origin" as const }];
  const buffer = await fetchBufferFromSources(sources, asset.hash, asset.path);
  await seedAssetCache({ [asset.path]: new Uint8Array(buffer) });
}

let landingPrefetchStarted = false;

export async function startLandingAssetPrefetch(): Promise<void> {
  if (!isPrefetchActive() || landingPrefetchStarted) {
    return;
  }

  landingPrefetchStarted = true;
  const config = await fetchBootstrapConfig();
  if (!config?.staticAssets?.length) {
    return;
  }

  await ensureAssetServiceWorker();
  await Promise.all(
    config.staticAssets.map((asset) =>
      downloadAndSeedStaticAsset(asset).catch(() => undefined)
    )
  );
}

export function scheduleLandingAssetPrefetch(): void {
  if (!isPrefetchActive() || typeof window === "undefined") {
    return;
  }

  void startLandingAssetPrefetch();
}

export async function startConsolePrefetch(): Promise<void> {
  if (!isPrefetchActive()) {
    return;
  }

  const config = await fetchBootstrapConfig();
  if (!config?.prefetchPacks?.length) {
    return;
  }

  for (const pack of config.prefetchPacks) {
    const state = packStates.get(pack.id);
    if (!state || state.status !== "idle") {
      continue;
    }
    void startPrefetchPack(pack.id).catch(() => undefined);
  }
}

export function scheduleConsolePrefetch(): void {
  if (!isPrefetchActive() || typeof window === "undefined") {
    return;
  }

  const run = () => {
    void startConsolePrefetch();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }

  globalThis.setTimeout(run, 300);
}

export async function ensureConsolePageReady(
  exportName: string
): Promise<void> {
  if (!isPrefetchActive()) {
    return;
  }

  const config = await fetchBootstrapConfig();
  if (!config?.prefetchPacks?.length) {
    return;
  }

  const packIds = config.routeToPacks[exportName];
  if (!packIds?.length) {
    return;
  }

  for (const packId of packIds) {
    try {
      await startPrefetchPack(packId);
    } catch {
      // Fall back to normal module loading when prefetch fails.
    }
  }
}
