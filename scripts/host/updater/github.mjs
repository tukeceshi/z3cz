import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

import { compareVersions, displayVersion } from "./version.mjs";

const USER_AGENT = "z3cz-host-updater";
const DEFAULT_MIRROR = "https://ghfast.top";

/**
 * @typedef {{
 *   version: string,
 *   name: string,
 *   body: string,
 *   url: string,
 *   publishedAt: string,
 *   prerelease: boolean
 * }} Release
 */

/**
 * @param {string} repository
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Release>}
 */
export async function fetchLatestRelease(repository, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://api.github.com/repos/${repository}/releases?per_page=30`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub Release 返回 HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("解析 GitHub Release 失败");
  }
  const releases = payload.filter(
    (item) =>
      item &&
      !item.draft &&
      !item.prerelease &&
      typeof item.tag_name === "string" &&
      item.tag_name.startsWith("v")
  );
  if (releases.length === 0) {
    throw new Error("GitHub 尚未发布可用版本");
  }
  releases.sort((left, right) =>
    compareVersions(right.tag_name, left.tag_name)
  );
  const latest = releases[0];
  return {
    version: displayVersion(latest.tag_name),
    name: String(latest.name || latest.tag_name),
    body: String(latest.body || ""),
    url: String(latest.html_url || ""),
    publishedAt: latest.published_at
      ? new Date(latest.published_at).toISOString()
      : new Date().toISOString(),
    prerelease: Boolean(latest.prerelease),
  };
}

/**
 * @param {string} raw
 */
export function updaterArch(raw = process.arch) {
  if (raw === "arm64" || raw === "aarch64") {
    return "arm64";
  }
  return "amd64";
}

/**
 * @param {string} [arch]
 */
export function updaterAssetName(arch = updaterArch()) {
  return `z3cz-host-updater-linux-${arch}`;
}

/**
 * @param {string} sumsText
 * @param {string} assetName
 */
export function checksumForAsset(sumsText, assetName) {
  for (const line of String(sumsText || "").split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields.length >= 2 && fields[1] === assetName) {
      return fields[0];
    }
  }
  return "";
}

/**
 * @param {string} url
 */
export function mirroredGithubUrl(url) {
  const mirror = String(
    process.env.DAFTHUNK_GITHUB_MIRROR ||
      process.env.Z3CZ_GITHUB_MIRROR ||
      DEFAULT_MIRROR
  ).replace(/\/$/, "");
  if (!mirror || url.startsWith(`${mirror}/`)) {
    return url;
  }
  return `${mirror}/${url}`;
}

/**
 * @param {string} repository
 * @param {string} version
 * @param {string} assetName
 */
export function releaseAssetUrl(repository, version, assetName) {
  const tag = displayVersion(version);
  return `https://github.com/${repository}/releases/download/${tag}/${assetName}`;
}

/**
 * @param {string} repository
 * @param {string} version
 * @param {string} assetName
 * @param {string} destPath
 * @param {{
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 *   limitBytes?: number
 * }} [options]
 */
export async function downloadReleaseAsset(
  repository,
  version,
  assetName,
  destPath,
  options = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const primary = releaseAssetUrl(repository, version, assetName);
  const urls = [primary, mirroredGithubUrl(primary)].filter(
    (url, index, list) => list.indexOf(url) === index
  );
  let lastError = new Error(`无法下载 ${assetName}`);
  for (const url of urls) {
    try {
      await downloadToFile(fetchImpl, url, destPath, options);
      return destPath;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError;
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {string} destPath
 * @param {{ token?: string, limitBytes?: number }} options
 */
async function downloadToFile(fetchImpl, url, destPath, options) {
  const headers = { "User-Agent": USER_AGENT };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`下载 ${url} 返回 HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error(`下载 ${url} 没有响应体`);
  }
  const limit = options.limitBytes ?? 256 * 1024 * 1024;
  const length = Number(response.headers.get("content-length") || 0);
  if (length > limit) {
    throw new Error("Release 资产超过允许大小");
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.partial`;
  try {
    await pipeline(response.body, createWriteStream(tmp));
    const stat = fs.statSync(tmp);
    if (stat.size > limit) {
      throw new Error("Release 资产超过允许大小");
    }
    fs.renameSync(tmp, destPath);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}
