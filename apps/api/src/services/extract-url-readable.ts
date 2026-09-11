import { parseCanvasImportSourceUrl } from "./fetch-canvas-import-source";

export const WEB_READ_SOURCE_MAX_CHARS = 2_000_000;
export const WEB_READ_SOURCE_TIMEOUT_MS = 15_000;
export const WEB_READ_EXTRACT_MAX_CHARS = 24_000;

export type ExtractUrlReadableResult =
  | {
      readonly ok: true;
      readonly url: string;
      readonly title: string;
      readonly text: string;
    }
  | { readonly ok: false; readonly error: string; readonly status: 400 | 502 };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code))
    );
}

function clipText(text: string): string {
  if (text.length <= WEB_READ_EXTRACT_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, WEB_READ_EXTRACT_MAX_CHARS)}…`;
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const withBreaks = withoutNoise
    .replace(/<\/(p|div|h1|h2|h3|h4|li|br|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function pickContentHtml(html: string): string {
  const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0];
  if (article) {
    return article;
  }
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (main) {
    return main;
  }
  const body = html.match(/<body[\s\S]*?<\/body>/i)?.[0];
  return body ?? html;
}

export function extractReadableFromHtml(
  html: string
): { readonly title: string; readonly text: string } | null {
  const trimmed = html.trim();
  if (!trimmed) {
    return null;
  }
  const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities(
    titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? ""
  );
  const text = clipText(htmlToText(pickContentHtml(trimmed)));
  if (!text) {
    return null;
  }
  return { title, text };
}

export async function extractUrlReadable(
  url: string
): Promise<ExtractUrlReadableResult> {
  const parsed = parseCanvasImportSourceUrl(url);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error, status: 400 };
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(WEB_READ_SOURCE_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
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

  const html = await response.text();
  if (html.length > WEB_READ_SOURCE_MAX_CHARS) {
    return { ok: false, error: "内容太大", status: 400 };
  }

  const extracted = extractReadableFromHtml(html);
  if (!extracted) {
    return { ok: false, error: "没有可用正文", status: 400 };
  }

  return {
    ok: true,
    url: parsed.toString(),
    title: extracted.title,
    text: extracted.text,
  };
}
