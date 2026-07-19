import { readFileSync, writeFileSync } from "node:fs";

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

const out = [];
for (const [key, field] of Object.entries(tpl.Fields)) {
  const title = field.Title ?? "";
  if (
    field.Type === "Region" ||
    (field.Type === "Table" &&
      /容量费用|流量费用|标准存储|公网流出/.test(title))
  ) {
    out.push({ key, type: field.Type, title, field });
  }
}

writeFileSync(
  "d:/code/dafthunk/agent-tools/tos-pricing-extract.json",
  JSON.stringify(out, null, 2)
);
console.log("written", out.length, "sections");
