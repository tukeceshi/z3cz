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
const page = JSON.parse(html.slice(start + 15, jsonEnd)).loaderData[
  "__ssr_without_user/pricing/page"
];
writeFileSync(
  "d:/code/dafthunk/agent-tools/pricing-navData.json",
  JSON.stringify(page.navData, null, 2)
);
console.log("nav keys", Object.keys(page.navData ?? {}));
