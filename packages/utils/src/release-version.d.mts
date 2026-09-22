export function parseVersion(
  raw: string
): { major: number; minor: number; patch: number; pre: string[] } | null;
export function isReleaseVersion(raw: string): boolean;
export function displayVersion(raw: string): string;
export function dockerImageTag(raw: string): string;
export function compareVersions(left: string, right: string): number;
