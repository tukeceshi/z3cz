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

const field = tpl.Fields.Tableut6ubuhg;
const chargeCol = field.Columns.find((c) => c.Type === "chargeItem");
const priceCol = field.Columns.find((c) => c.Title === "按量计费");
const unitCol = field.Columns.find((c) => c.Title === "单位");

chargeCol.Data.forEach((item, i) => {
  if (item.DisplayName === "公网流出流量费用") {
    console.log(item.Region, priceCol.Data[i], unitCol.Data[i]);
  }
});

console.log("\noverseas:");
const field2 = tpl.Fields.Tableb1fetga4;
const c2 = field2.Columns.find((c) => c.Type === "chargeItem");
const p2 = field2.Columns.find((c) => c.Title === "按量计费");
const u2 = field2.Columns.find((c) => c.Title === "单位");
c2.Data.forEach((item, i) => {
  if (item.DisplayName === "公网流出流量费用") {
    console.log(item.Region, p2.Data[i], u2.Data[i]);
  }
});
