import { readFileSync } from "node:fs";

const sections = JSON.parse(
  readFileSync("d:/code/dafthunk/agent-tools/tos-pricing-extract.json", "utf8")
);

const chinaCapacity = sections.find((s) => s.key === "Tablehlj5pbfg");
const field = chinaCapacity.field;
const chargeCol = field.Columns.find((c) => c.Type === "chargeItem");
const priceCol = field.Columns.find((c) => c.Title === "按量计费");

for (let i = 0; i < 12; i += 1) {
  const item = chargeCol.Data[i];
  console.log(
    i,
    item.Region,
    item.DisplayName,
    priceCol.Data[i],
    field.Columns.find((c) => c.Title === "单位")?.Data[i]
  );
}
