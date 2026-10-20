import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/views/tms/transport/presentation.ts", import.meta.url),
  "utf8"
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { tripCargoByOrder } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const pallets = [
  {
    containerId: "P1",
    containerCode: "P001",
    containerType: "托盘",
    status: "LOADED",
    items: [
      {
        orderId: "O1",
        orderNo: "DD001",
        orderItemId: "L1",
        goodsName: "商品A",
        unit: "件",
        quantity: "99999999999999"
      },
      {
        orderId: "O2",
        orderNo: "DD002",
        orderItemId: "L2",
        goodsName: "商品B",
        unit: "箱",
        quantity: "2"
      }
    ]
  },
  {
    containerId: "P2",
    containerCode: "V001",
    containerType: "虚拟托盘",
    status: "UNLOADED",
    items: [
      {
        orderId: "O1",
        orderNo: "DD001",
        orderItemId: "L1",
        goodsName: "商品A",
        unit: "件",
        quantity: "3"
      }
    ]
  }
];
test("order view combines multiple physical and virtual pallets and preserves source allocations", () => {
  const orders = tripCargoByOrder(pallets);
  assert.equal(orders.length, 2);
  assert.equal(orders[0].orderNo, "DD001");
  assert.equal(orders[0].items.length, 1);
  assert.equal(orders[0].items[0].quantity, "100000000000002");
  assert.deepEqual(
    orders[0].items[0].allocations.map(row => row.containerCode),
    ["P001", "V001"]
  );
  assert.deepEqual(
    orders[0].items[0].allocations.map(row => row.status),
    ["LOADED", "UNLOADED"]
  );
  assert.equal(orders[1].items[0].quantity, "2");
  assert.equal(pallets[0].items[0].quantity, "99999999999999");
});
test("quantity aggregation retains four decimal places without floating point loss", () => {
  const input = structuredClone(pallets);
  input[0].items[0].quantity = "0.0001";
  input[1].items[0].quantity = "0.0002";
  assert.equal(tripCargoByOrder(input)[0].items[0].quantity, "0.0003");
});
test("empty cargo produces no orders and malformed quantities cannot become misleading totals", () => {
  assert.deepEqual(tripCargoByOrder([]), []);
  const input = structuredClone(pallets);
  input[0].items[0].quantity = "invalid";
  assert.throws(() => tripCargoByOrder(input), /数量格式/);
});
