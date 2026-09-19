import { compareVersions, displayVersion } from "./version.mjs";

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
    "User-Agent": "z3cz-host-updater",
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
