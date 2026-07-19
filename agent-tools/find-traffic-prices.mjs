import { readFileSync } from "node:fs";

const html = readFileSync("d:/code/dafthunk/agent-tools/tos-pricing.html", "utf8");
const start = html.indexOf("_ROUTER_DATA = ");
let depth = 0;
let jsonEnd = start + 15;
for (let i = start + 15; i < html.length; i += 1) {
  const ch = html[i];
  if (ch === "{") depth += 1;
  else if (ch === "}") {
    depth -= 1;
    if (depth === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
}
const raw = html.slice(start + 15, jsonEnd);

const codes = [
  "traffic cost busy time_cn-beijing",
  "traffic cost busy time_cn-guangzhou",
  "traffic cost busy time_cn-shanghai",
  "traffic_cost_busy_time_ap-southeast-1",
  "traffic_cost_busy_time_ap-southeast-3",
];

for (const code of codes) {
  const idx = raw.indexOf(code);
  console.log("\n", code, "at", idx);
  if (idx >= 0) {
    console.log(raw.slice(idx, idx + 800));
  }
}
