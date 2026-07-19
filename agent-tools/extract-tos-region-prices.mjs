import { readFileSync } from "node:fs";

const sections = JSON.parse(
  readFileSync("d:/code/dafthunk/agent-tools/tos-pricing-extract.json", "utf8")
);

const regions = [
  "cn-guangzhou",
  "cn-beijing",
  "cn-shanghai",
  "ap-southeast-1",
  "ap-southeast-3",
];

function walkRows(rows, acc = []) {
  if (!rows) return acc;
  for (const row of rows) {
    if (row.ChargeItem) acc.push(row.ChargeItem);
    if (row.Children) walkRows(row.Children, acc);
    if (row.SubRows) walkRows(row.SubRows, acc);
  }
  return acc;
}

for (const section of sections) {
  const items = walkRows(section.field.Rows ?? section.field.ChargeItems);
  for (const region of regions) {
    const storage = items.find(
      (item) =>
        item.Region === region &&
        (item.DisplayName === "标准存储" ||
          item.Name?.includes("standard_storage") ||
          item.ChargeItemCode?.includes("standard_storage"))
    );
    const egress = items.find(
      (item) =>
        item.Region === region &&
        item.DisplayName === "公网流出流量费用"
    );
    if (storage || egress) {
      console.log(region, {
        storage: storage
          ? {
              name: storage.Name,
              display: storage.DisplayName,
              price: storage.Price,
              unit: storage.Unit,
            }
          : null,
        egress: egress
          ? {
              name: egress.Name,
              display: egress.DisplayName,
              price: egress.Price,
              unit: egress.Unit,
            }
          : null,
      });
    }
  }
}
