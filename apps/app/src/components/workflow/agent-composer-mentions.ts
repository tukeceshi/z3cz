export interface AgentMentionNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface AgentMentionQuery {
  readonly start: number;
  readonly query: string;
}

export function mentionQueryAtCaret(
  text: string,
  caret: number
): AgentMentionQuery | undefined {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) {
    return undefined;
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? "")) {
    return undefined;
  }
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.includes(" ")) {
    return undefined;
  }
  return { start: at, query };
}

export function filterMentionNodes(
  nodes: readonly AgentMentionNode[],
  query: string
): readonly AgentMentionNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return nodes.slice(0, 8);
  }
  return nodes
    .filter((node) => {
      const name = node.name.toLowerCase();
      const type = node.type.toLowerCase();
      return (
        name.includes(needle) ||
        type.includes(needle) ||
        node.id.toLowerCase().includes(needle)
      );
    })
    .slice(0, 8);
}

export function insertMention(
  text: string,
  caret: number,
  mention: AgentMentionQuery,
  node: AgentMentionNode
): { readonly text: string; readonly caret: number } {
  const token = `@${node.name} `;
  const next = `${text.slice(0, mention.start)}${token}${text.slice(caret)}`;
  return { text: next, caret: mention.start + token.length };
}
