export const CANVAS_IMPORT_SOURCE_MAX_CHARS = 2_000_000;
export const CANVAS_IMPORT_SOURCE_TIMEOUT_MS = 15_000;

export type FetchCanvasImportSourceResult =
  | { readonly ok: true; readonly document: unknown }
  | { readonly ok: false; readonly error: string; readonly status: 400 | 502 };

export function parseCanvasImportSourceUrl(
  value: string
): URL | { readonly error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "缺少 url" };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "无效的地址" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "只支持 http 或 https" };
  }
  return parsed;
}

export async function fetchCanvasImportSource(
  url: string
): Promise<FetchCanvasImportSourceResult> {
  const parsed = parseCanvasImportSourceUrl(url);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error, status: 400 };
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(CANVAS_IMPORT_SOURCE_TIMEOUT_MS),
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
  } catch {
    return { ok: false, error: "无法读取该地址", status: 502 };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `读取失败（${response.status}）`,
      status: 502,
    };
  }

  const text = await response.text();
  if (text.length > CANVAS_IMPORT_SOURCE_MAX_CHARS) {
    return { ok: false, error: "内容太大", status: 400 };
  }

  try {
    return { ok: true, document: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "不是 JSON", status: 400 };
  }
}
