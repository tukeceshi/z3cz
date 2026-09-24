import type { SystemUpdateLog, SystemUpdatePhase } from "@dafthunk/types";

export interface SystemUpdateLogGroup {
  readonly phase: SystemUpdatePhase;
  readonly at: string;
  readonly messages: readonly string[];
}

function displayMessage(message: string): string {
  return message.replace(/^==>\s*/, "");
}

/** Consecutive logs in the same phase share one heading. A later return to that phase starts a new group. */
export function groupSystemUpdateLogs(
  logs: readonly SystemUpdateLog[]
): readonly SystemUpdateLogGroup[] {
  const groups: {
    phase: SystemUpdatePhase;
    at: string;
    messages: string[];
  }[] = [];
  for (const entry of logs) {
    const message = displayMessage(entry.message);
    if (!message) continue;
    const current = groups.at(-1);
    if (current && current.phase === entry.phase) {
      current.messages.push(message);
      current.at = entry.at;
      continue;
    }
    groups.push({
      phase: entry.phase,
      at: entry.at,
      messages: [message],
    });
  }
  return groups;
}
