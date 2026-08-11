/**
 * Benchmark shell download strategies against z3cz.com (or any Range-capable URL).
 * Usage: node scripts/shell-download-bench.mjs [url]
 */

const DEFAULT_URL =
  "https://z3cz.com/assets/shell-3500a85bb2c2dcce.gz";

const url = process.argv[2] ?? DEFAULT_URL;
const CHUNK_TARGETS = [1, 4, 6, 8];
const RUNS = Number(process.env.BENCH_RUNS ?? "2");
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS ?? "120000");

function fetchWithTimeout(targetUrl, init = {}) {
  return fetch(targetUrl, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function ms(start) {
  return Math.round(performance.now() - start);
}

async function headContentLength(targetUrl) {
  const response = await fetchWithTimeout(targetUrl, {
    method: "HEAD",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`HEAD failed: ${response.status}`);
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  const acceptRanges = response.headers.get("accept-ranges") ?? "";
  return { length, acceptRanges, status: response.status };
}

async function downloadSingle(targetUrl) {
  const start = performance.now();
  const response = await fetchWithTimeout(targetUrl, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`GET failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return {
    strategy: "single",
    ms: ms(start),
    bytes: buffer.byteLength,
  };
}

function buildRanges(totalBytes, parts) {
  const chunkSize = Math.ceil(totalBytes / parts);
  const ranges = [];
  for (let index = 0; index < parts; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(totalBytes - 1, start + chunkSize - 1);
    if (start > end) {
      break;
    }
    ranges.push({ start, end });
  }
  return ranges;
}

async function downloadRangePart(targetUrl, start, end) {
  const partStart = performance.now();
  const response = await fetchWithTimeout(targetUrl, {
    cache: "no-store",
    headers: {
      Range: `bytes=${start}-${end}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (response.status !== 206 && response.status !== 200) {
    throw new Error(`Range GET failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return {
    start,
    end,
    ms: ms(partStart),
    bytes: buffer.byteLength,
    buffer,
  };
}

async function downloadParallel(targetUrl, totalBytes, parts) {
  const start = performance.now();
  const ranges = buildRanges(totalBytes, parts);
  const chunks = await Promise.all(
    ranges.map(({ start, end }) => downloadRangePart(targetUrl, start, end))
  );

  const merged = new Uint8Array(totalBytes);
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk.buffer), chunk.start);
  }

  const partMs = chunks.map((chunk) => chunk.ms);
  return {
    strategy: `range-x${parts}`,
    ms: ms(start),
    bytes: merged.byteLength,
    parts: chunks.length,
    partMs,
    maxPartMs: Math.max(...partMs),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

async function runStrategy(label, fn) {
  const timings = [];
  let lastResult = null;
  for (let run = 1; run <= RUNS; run += 1) {
    const result = await fn();
    timings.push(result.ms);
    lastResult = result;
    console.log(`  run${run}: ${result.ms}ms (${result.bytes} bytes)`);
    if (result.partMs) {
      console.log(`         parts: ${result.partMs.join(", ")}ms`);
    }
  }
  return {
    label,
    medianMs: median(timings),
    timings,
    lastResult,
  };
}

async function main() {
  console.log(`Shell download benchmark`);
  console.log(`URL: ${url}`);
  console.log(`Runs per strategy: ${RUNS}\n`);

  const head = await headContentLength(url);
  console.log(
    `HEAD: ${head.length} bytes, accept-ranges=${head.acceptRanges || "n/a"}\n`
  );

  if (!head.length) {
    throw new Error("Missing Content-Length; cannot benchmark ranges");
  }

  const results = [];

  results.push(
    await runStrategy("single GET", () => downloadSingle(url))
  );
  console.log("");

  for (const parts of CHUNK_TARGETS.filter((count) => count > 1)) {
    results.push(
      await runStrategy(`parallel Range x${parts}`, () =>
        downloadParallel(url, head.length, parts)
      )
    );
    console.log("");
  }

  console.log("=== Summary (median ms) ===");
  const baseline = results[0].medianMs;
  for (const result of results) {
    const delta = result.medianMs - baseline;
    const pct =
      baseline > 0 ? Math.round((delta / baseline) * 100) : 0;
    const sign = delta <= 0 ? "" : "+";
    console.log(
      `${result.label.padEnd(22)} ${String(result.medianMs).padStart(5)}ms  (${sign}${pct}% vs single)`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
