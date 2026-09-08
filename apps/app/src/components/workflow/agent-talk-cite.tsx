import type { ReactNode } from "react";

import { parseCiteHeader } from "@/services/agent-chat-scheduler";

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;

export interface AgentTalkCite {
  readonly startLine: number;
  readonly endLine: number;
  readonly filepath: string;
}

interface AgentTalkCiteProps {
  readonly talk: string;
  readonly onOpenCite?: (cite: AgentTalkCite) => void;
}

export function AgentTalkCite({ talk, onOpenCite }: AgentTalkCiteProps) {
  const parts: ReactNode[] = [];
  let last = 0;
  let index = 0;
  const matches = talk.matchAll(FENCE);
  for (const match of matches) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push(talk.slice(last, start));
    }
    const header = match[1] ?? "";
    const body = match[2] ?? "";
    const cite = parseCiteHeader(header);
    if (cite && onOpenCite) {
      parts.push(
        <button
          key={`cite-${index}`}
          type="button"
          className="my-1 block w-full rounded-md bg-neutral-100 px-2 py-1 text-left font-mono text-xs text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          onClick={() => onOpenCite(cite)}
        >
          {cite.filepath}:{cite.startLine}-{cite.endLine}
        </button>
      );
    } else {
      parts.push(
        <pre
          key={`fence-${index}`}
          className="my-1 overflow-x-auto rounded-md bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-800"
        >
          {body}
        </pre>
      );
    }
    last = start + match[0].length;
    index += 1;
  }
  if (last < talk.length) {
    parts.push(talk.slice(last));
  }
  return (
    <div className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-100">
      {parts}
    </div>
  );
}
