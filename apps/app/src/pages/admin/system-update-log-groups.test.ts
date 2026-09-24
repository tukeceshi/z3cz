import { describe, expect, it } from "vitest";

import { groupSystemUpdateLogs } from "./system-update-log-groups";

describe("groupSystemUpdateLogs", () => {
  it("merges consecutive logs that share a phase and keeps the latest time", () => {
    const groups = groupSystemUpdateLogs([
      {
        at: "2026-09-24T08:19:40.000Z",
        phase: "preflight",
        message: "宿主机正在复核后台准备的更新包",
      },
      {
        at: "2026-09-24T08:19:43.000Z",
        phase: "preflight",
        message: "==> 正在安装生产依赖",
      },
    ]);
    expect(groups).toEqual([
      {
        phase: "preflight",
        at: "2026-09-24T08:19:43.000Z",
        messages: ["宿主机正在复核后台准备的更新包", "正在安装生产依赖"],
      },
    ]);
  });

  it("starts a new group when the phase changes, including a later return", () => {
    const groups = groupSystemUpdateLogs([
      { at: "1", phase: "preflight", message: "复核" },
      { at: "2", phase: "backing_up", message: "备份" },
      { at: "3", phase: "preflight", message: "再次检查" },
    ]);
    expect(groups.map((group) => group.phase)).toEqual([
      "preflight",
      "backing_up",
      "preflight",
    ]);
    expect(groups[2]?.messages).toEqual(["再次检查"]);
  });
});
