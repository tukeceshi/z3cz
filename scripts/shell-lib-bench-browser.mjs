/**
 * In-browser shell library benchmark (paste/run on z3cz.com console or via CDP).
 * Libraries loaded from esm.sh CDN.
 */
export async function runShellLibBench(shellUrl) {
  const SHELL_URL =
    shellUrl ?? "https://z3cz.com/assets/shell-3500a85bb2c2dcce.gz";
  const NO_CACHE = {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  };

  const results = [];

  async function bench(label, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const ms = Math.round(performance.now() - start);
      results.push({ label, ok: true, ms, bytes: result.bytes, note: result.note });
      return ms;
    } catch (error) {
      const ms = Math.round(performance.now() - start);
      results.push({
        label,
        ok: false,
        ms,
        error: error instanceof Error ? error.message : String(error),
      });
      return ms;
    }
  }

  await bench("native fetch", async () => {
    const r = await fetch(SHELL_URL, NO_CACHE);
    const b = await r.arrayBuffer();
    return { bytes: b.byteLength };
  });

  await bench("@fastblob/fast-fetch", async () => {
    const { default: fastFetch } = await import(
      "https://esm.sh/@fastblob/fast-fetch@1.0.5"
    );
    const r = await fastFetch(SHELL_URL, { ...NO_CACHE, fastFetch: {} });
    const b = await r.arrayBuffer();
    return { bytes: b.byteLength };
  });

  await bench("semlinker asyncPool x4", async () => {
    const head = await fetch(SHELL_URL, { ...NO_CACHE, method: "HEAD" });
    const total = Number(head.headers.get("content-length"));
    const parts = 4;
    const chunk = Math.ceil(total / parts);
    const chunks = await Promise.all(
      [...Array(parts).keys()].map(async (i) => {
        const start = i * chunk;
        const end = i + 1 === parts ? total - 1 : (i + 1) * chunk - 1;
        const r = await fetch(SHELL_URL, {
          ...NO_CACHE,
          headers: { ...NO_CACHE.headers, Range: `bytes=${start}-${end}` },
        });
        return { start, buf: await r.arrayBuffer() };
      })
    );
    const merged = new Uint8Array(total);
    chunks.forEach((c) => merged.set(new Uint8Array(c.buf), c.start));
    return { bytes: merged.byteLength, note: "asyncPool x4" };
  });

  await bench("Backblaze-style x6", async () => {
    const head = await fetch(SHELL_URL, { ...NO_CACHE, method: "HEAD" });
    const total = Number(head.headers.get("content-length"));
    const threads = 6;
    const chunk = Math.ceil(total / threads);
    const chunks = await Promise.all(
      [...Array(threads).keys()].map(async (i) => {
        const start = i * chunk;
        const end = i + 1 === threads ? total - 1 : (i + 1) * chunk - 1;
        const r = await fetch(SHELL_URL, {
          ...NO_CACHE,
          headers: { ...NO_CACHE.headers, Range: `bytes=${start}-${end}` },
        });
        return { start, buf: await r.arrayBuffer() };
      })
    );
    const merged = new Uint8Array(total);
    chunks.forEach((c) => merged.set(new Uint8Array(c.buf), c.start));
    return { bytes: merged.byteLength, note: "parallel x6" };
  });

  await bench("@jobkaehenry/whisper-fetch", async () => {
    const { BackgroundPrefetcher } = await import(
      "https://esm.sh/@jobkaehenry/whisper-fetch@0.1.8"
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        prefetch.stop();
        reject(new Error("timeout 120s"));
      }, 120000);
      let downloaded = 0;
      const prefetch = new BackgroundPrefetcher({
        url: SHELL_URL,
        chunkSize: 256 * 1024,
        allowOnCellular: true,
        respectSaveData: false,
        minDownlinkMbps: 0,
        store: "idb",
        onProgress: (n) => {
          downloaded = n;
        },
        onStatus: (status, err) => {
          if (status === "completed") {
            clearTimeout(timer);
            resolve({ bytes: downloaded, note: "BackgroundPrefetcher" });
          }
          if (status === "error") {
            clearTimeout(timer);
            reject(err ?? new Error("whisper error"));
          }
        },
      });
      void prefetch.start().catch(reject);
    });
  });

  results.push({
    label: "range-request-fetcher",
    ok: false,
    ms: 0,
    error: "requires showSaveFilePicker (not automatable)",
  });

  const baseline = results.find((r) => r.label === "native fetch" && r.ok);
  return {
    shellUrl: SHELL_URL,
    results,
    summary: results.map((r) => {
      if (!r.ok) return { ...r };
      const pct =
        baseline?.ms && r.ms
          ? Math.round(((r.ms - baseline.ms) / baseline.ms) * 100)
          : 0;
      return { label: r.label, ms: r.ms, bytes: r.bytes, vsNativePct: pct, note: r.note };
    }),
  };
}
