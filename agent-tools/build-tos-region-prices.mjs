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
const data = JSON.parse(html.slice(start + 15, jsonEnd));
const tpl = JSON.parse(
  data.loaderData["__ssr_without_user/pricing/page"].ssrTemplate.Template
);

const regions = [
  "cn-guangzhou",
  "cn-beijing",
  "cn-shanghai",
  "ap-southeast-1",
  "ap-southeast-3",
];

function parseTable(field) {
  const chargeCol = field.Columns?.find((c) => c.Type === "chargeItem");
  const priceCol = field.Columns?.find((c) => c.Title === "按量计费");
  const unitCol = field.Columns?.find((c) => c.Title === "单位");
  if (!chargeCol?.Data || !priceCol?.Data) return [];
  return chargeCol.Data.map((item, index) => ({
    region: item.Region,
    displayName: item.DisplayName,
    name: item.Name,
    price: priceCol.Data[index],
    unit: unitCol?.Data?.[index] ?? item.Unit,
  }));
}

const byRegion = Object.fromEntries(
  regions.map((r) => [
    r,
    { standardStorage: null, publicEgress: null },
  ])
);

for (const field of Object.values(tpl.Fields)) {
  if (field.Type !== "Table") continue;
  const rows = parseTable(field);
  for (const row of rows) {
    if (!regions.includes(row.region)) continue;
    if (row.displayName === "标准存储容量费用") {
      byRegion[row.region].standardStorage = row;
    }
    if (row.displayName === "公网流出流量费用") {
      byRegion[row.region].publicEgress = row;
    }
  }
}

console.log(JSON.stringify(byRegion, null, 2));
