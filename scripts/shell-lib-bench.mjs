/**
 * Compare mature shell download libraries on z3cz.com
 * Run inside docker:
 *   docker exec dafthunk-app-dev sh -c "cd /tmp/shell-lib-bench && node /app/scripts/shell-lib-bench.mjs"
 */

const nativeFetch = globalThis.fetch.bind(globalThis);
import fastFetch from "@fastblob/fast-fetch";
import { rangeRequestFetcher } from "range-request-fetcher";
import { BackgroundPrefetcher } from "@jobkaehenry/whisper-fetch";

const SHELL_URL =
  process.env.SHELL_URL ??
  "https://z3cz.com/assets/shell-3500a85bb2c2dcce.gz";
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS ?? "180000");

function ms(start) {
  return Math.round(performance.now() - start);
}

async function bench(label, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const elapsed = ms(start);
    console.log(
      `[OK] ${label.padEnd(28)} ${String(elapsed).padStart(6)}ms  ${result.bytes} bytes${result.note ? `  (${result.note})` : ""}`
    );
    return { label, ok: true, ms: elapsed, bytes: result.bytes, note: result.note };
  } catch (error) {
    const elapsed = ms(start);
    const message =
      error instanceof Error ? error.message : String(error);
    console.log(
      `[FAIL] ${label.padEnd(28)} ${String(elapsed).padStart(6)}ms  ${message}`
    );
    return { label, ok: false, ms: elapsed, error: message };
  }
}

async function nativeSingle() {
  const response = await nativeFetch(SHELL_URL, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return { bytes: buffer.byteLength };
}

async function fastblobFetch() {
  const response = await fastFetch(SHELL_URL, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    fastFetch: {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return { bytes: buffer.byteLength };
}

async function semlinkerAsyncPool() {
  const head = await nativeFetch(SHELL_URL, {
    method: "HEAD",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const total = Number(head.headers.get("content-length") ?? "0");
  if (!total) {
    throw new Error("missing content-length");
  }

  const parts = 4;
  const chunkSize = Math.ceil(total / parts);

  async function asyncPool(concurrency, iterable, iteratorFn) {
    const results = [];
    const executing = new Set();
    for (const item of iterable) {
      const task = Promise.resolve().then(() => iteratorFn(item));
      results.push(task);
      executing.add(task);
      const clean = () => executing.delete(task);
      task.then(clean).catch(clean);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    return Promise.all(results);
  }

  async function fetchRange(index) {
    const start = index * chunkSize;
    const end =
      index + 1 === parts ? total - 1 : (index + 1) * chunkSize - 1;
    const response = await nativeFetch(SHELL_URL, {
      cache: "no-store",
      headers: {
        Range: `bytes=${start}-${end}`,
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status !== 206 && response.status !== 200) {
      throw new Error(`range status ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return { index, start, buffer };
  }

  const chunks = await asyncPool(4, [...Array(parts).keys()], fetchRange);
  const merged = new Uint8Array(total);
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk.buffer), chunk.start);
  }
  return { bytes: merged.byteLength, note: "gist asyncPool x4" };
}

async function rangeRequestFetcherLib() {
  const chunks = [];
  let totalBytes = 0;

  const download = rangeRequestFetcher({
    url: SHELL_URL,
    fileName: "shell.gz",
    chunkSize: 256 * 1024,
    maxRetries: 3,
    headers: { "Cache-Control": "no-cache" },
    onProgress: () => {},
    onStatus: () => {},
    onChunk: (chunk) => {
      chunks.push(chunk);
      totalBytes += chunk.byteLength ?? chunk.length ?? 0;
    },
  });

  await Promise.race([
    download.promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("timeout")),
        TIMEOUT_MS
      )
    ),
  ]);

  return {
    bytes: totalBytes,
    note: "chunkSize 256KB",
  };
}

async function whisperFetchLib() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      prefetch.stop();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);

    let downloaded = 0;
    const prefetch = new BackgroundPrefetcher({
      url: SHELL_URL,
      chunkSize: 256 * 1024,
      allowOnCellular: true,
      respectSaveData: false,
      minDownlinkMbps: 0,
      store: "idb",
      onProgress: (done) => {
        downloaded = done;
      },
      onStatus: (status, error) => {
        if (status === "completed") {
          clearTimeout(timer);
          resolve({ bytes: downloaded, note: "BackgroundPrefetcher idb" });
        }
        if (status === "error") {
          clearTimeout(timer);
          reject(error ?? new Error("whisper-fetch error"));
        }
      },
    });

    void prefetch.start().catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main() {
  console.log("Shell library benchmark (Node fetch)");
  console.log(`URL: ${SHELL_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms\n`);

  const results = [];
  results.push(await bench("native fetch (single)", nativeSingle));
  results.push(await bench("@fastblob/fast-fetch", fastblobFetch));
  results.push(await bench("semlinker asyncPool x4", semlinkerAsyncPool));
  results.push(
    await bench("range-request-fetcher", rangeRequestFetcherLib)
  );
  results.push(await bench("@jobkaehenry/whisper-fetch", whisperFetchLib));

  console.log("\n=== Summary ===");
  const baseline = results.find((item) => item.label.includes("native"));
  for (const item of results) {
    if (!item.ok) {
      console.log(`${item.label}: FAILED (${item.error})`);
      continue;
    }
    const delta =
      baseline?.ok && item.ms && baseline.ms
        ? Math.round(((item.ms - baseline.ms) / baseline.ms) * 100)
        : 0;
    const sign = delta <= 0 ? "" : "+";
    console.log(`${item.label}: ${item.ms}ms (${sign}${delta}% vs native)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
