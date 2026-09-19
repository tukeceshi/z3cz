import type { SystemUpdateRelease } from "@dafthunk/types";

const REPOSITORY = "tukeceshi/z3cz";

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

function parseCore(raw: string): [number, number, number, string] | null {
  let value = raw.trim();
  if (value.startsWith("v") || value.startsWith("V")) {
    value = value.slice(1);
  }
  const [core, pre = ""] = value.split("-", 2);
  const parts = (core ?? "").split(".");
  if (parts.length !== 3) {
    return null;
  }
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) {
    return null;
  }
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, pre];
}

function compareTags(left: string, right: string): number {
  const a = parseCore(left);
  const b = parseCore(right);
  if (!a && b) {
    return -1;
  }
  if (a && !b) {
    return 1;
  }
  if (!a || !b) {
    return left.localeCompare(right);
  }
  if (a[0] !== b[0]) {
    return a[0] < b[0] ? -1 : 1;
  }
  if (a[1] !== b[1]) {
    return a[1] < b[1] ? -1 : 1;
  }
  if (a[2] !== b[2]) {
    return a[2] < b[2] ? -1 : 1;
  }
  if (!a[3] && b[3]) {
    return 1;
  }
  if (a[3] && !b[3]) {
    return -1;
  }
  return a[3].localeCompare(b[3]);
}

export async function fetchLatestGithubRelease(): Promise<SystemUpdateRelease> {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/releases?per_page=30`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "z3cz-api",
      },
    }
  );
  if (!response.ok) {
    throw new Error(`GitHub Release 返回 HTTP ${response.status}`);
  }
  const payload = (await response.json()) as GitHubRelease[];
  const releases = payload.filter(
    (item) =>
      !item.draft &&
      typeof item.tag_name === "string" &&
      item.tag_name.startsWith("v")
  );
  if (releases.length === 0) {
    throw new Error("GitHub 尚未发布可用版本");
  }
  releases.sort((left, right) =>
    compareTags(right.tag_name ?? "", left.tag_name ?? "")
  );
  const latest = releases[0];
  const version = latest?.tag_name ?? "";
  return {
    version,
    name: latest?.name || version,
    body: latest?.body || "",
    url: latest?.html_url || "",
    publishedAt: latest?.published_at
      ? new Date(latest.published_at).toISOString()
      : new Date().toISOString(),
    prerelease: Boolean(latest?.prerelease),
  };
}
