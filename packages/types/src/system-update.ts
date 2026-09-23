export const SYSTEM_UPDATE_PHASES = [
  "idle",
  "checking",
  "downloading",
  "verifying_download",
  "extracting",
  "preparing",
  "ready",
  "no_update",
  "preflight",
  "backing_up",
  "pulling",
  "draining",
  "migrating",
  "switching",
  "verifying",
  "succeeded",
  "rolling_back",
  "rolled_back",
  "failed",
  "manual_intervention",
] as const;

export type SystemUpdatePhase = (typeof SYSTEM_UPDATE_PHASES)[number];

export interface SystemUpdateRelease {
  readonly version: string;
  readonly name: string;
  readonly body: string;
  readonly url: string;
  readonly publishedAt: string;
  readonly prerelease: boolean;
}

export interface SystemUpdateCheck {
  readonly key: string;
  readonly label: string;
  readonly status: "passed" | "pending" | "failed";
  readonly detail?: string;
  readonly blocking: boolean;
}

export interface SystemUpdateBackup {
  readonly id: string;
  readonly path: string;
  readonly checksum: string;
  readonly size: number;
  readonly createdAt: string;
  readonly version: string;
}

export interface SystemUpdateLog {
  readonly at: string;
  readonly phase: SystemUpdatePhase;
  readonly message: string;
}

export interface SystemUpdateOperation {
  readonly mode?: "light" | "full";
  readonly id?: string;
  readonly phase: SystemUpdatePhase;
  readonly fromVersion?: string;
  readonly targetVersion?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly error?: string;
  readonly rollbackError?: string;
  readonly automaticRollback: boolean;
  readonly progress?: number;
  readonly downloadedBytes?: number;
  readonly totalBytes?: number;
  readonly packageChecksum?: string;
  readonly logs: readonly SystemUpdateLog[];
}

export const SYSTEM_UPDATE_SOURCE_CHANNELS = ["github", "gitee"] as const;

export type SystemUpdateSourceChannel =
  (typeof SYSTEM_UPDATE_SOURCE_CHANNELS)[number];

export interface SystemUpdateStatus {
  readonly supported: boolean;
  readonly connected: boolean;
  readonly repository: string;
  readonly deployment: string;
  readonly currentVersion: string;
  readonly sourceChannel: SystemUpdateSourceChannel;
  readonly latestRelease?: SystemUpdateRelease;
  readonly updateAvailable: boolean;
  readonly checkedAt?: string;
  readonly stale?: boolean;
  readonly checkError?: string;
  readonly checks: readonly SystemUpdateCheck[];
  readonly lastBackup?: SystemUpdateBackup;
  readonly rollbackVersion?: string;
  readonly rollbackRequiresRestore?: boolean;
  readonly rollbackBackup?: SystemUpdateBackup;
  readonly operation: SystemUpdateOperation;
}

export interface StartSystemUpdateRequest {
  readonly targetVersion: string;
}

export interface SetSystemUpdateSourceChannelRequest {
  readonly sourceChannel: SystemUpdateSourceChannel;
}

export interface RollbackSystemUpdateRequest {
  readonly reason: string;
}
