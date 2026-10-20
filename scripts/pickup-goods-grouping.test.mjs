import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/views/tms/pickup/presentation.ts", import.meta.url),
  "utf8"
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { pickupGoodsGroups, createPalletCode } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const task = {
  items: [
    { orderId: "O1", orderNo: "DD001", orderItemId: "L1" },
    { orderId: "O2", orderNo: "DD002", orderItemId: "L2" },
    { orderId: "O3", orderNo: "DD003", orderItemId: "L3" }
  ]
};
const containers = [
  {
    containerId: "C1",
    containerCode: "PALLET-1",
    containerType: "托盘",
    items: [
      { orderItemId: "L1", quantity: "99999999999999", goodsName: "goods 1" },
      { orderItemId: "L2", quantity: "2", goodsName: "goods 2" }
    ]
  },
  {
    containerId: "C2",
    containerCode: "V001",
    containerType: "虚拟托盘",
    items: [{ orderItemId: "L1", quantity: "3", goodsName: "goods 1" }]
  }
];
test("physical and virtual pallets share the same allocation model", () => {
  const result = pickupGoodsGroups(task, containers);
  assert.equal(result.containerCount, 2);
  assert.equal(result.virtualCount, 1);
  assert.equal(result.orders[0].actual[1].orderNo, "DD001");
  assert.equal(result.orders[0].actual[1].containerCode, "V001");
});
test("order grouping combines pallet and loose sources without losing quantities or unpicked orders", () => {
  const result = pickupGoodsGroups(task, containers);
  assert.equal(result.orders.length, 3);
  assert.deepEqual(
    result.orders[0].actual.map(item => item.quantity),
    ["99999999999999", "3"]
  );
  assert.deepEqual(
    result.orders[0].actual.map(item => item.containerType),
    ["托盘", "虚拟托盘"]
  );
  assert.equal(result.orders[2].planned.length, 1);
  assert.equal(result.orders[2].actual.length, 0);
});
test("virtual-only pickup is tracked as one pallet", () => {
  const result = pickupGoodsGroups(task, [containers[1]]);
  assert.equal(result.containerCount, 1);
  assert.equal(result.virtualCount, 1);
  assert.equal(result.orders[0].actual[0].quantity, "3");
});

test("planned and actual stay on one product row despite multiple actual batches", () => {
  const result = pickupGoodsGroups(task, containers);
  const order = result.orders[0];
  assert.equal(order.planned.length, 1);
  assert.equal(order.planned[0].orderItemId, "L1");
  assert.deepEqual(
    order.planned[0].allocations.map(item => item.quantity),
    ["99999999999999", "3"]
  );
  assert.equal(result.orders[2].planned[0].allocations.length, 0);
});

test("virtual pallet codes start with V and physical codes use P", () => {
  assert.match(createPalletCode("虚拟托盘"), /^V[A-F0-9]{32}$/);
  assert.match(createPalletCode("托盘"), /^P[A-F0-9]{32}$/);
  assert.notEqual(createPalletCode("虚拟托盘"), createPalletCode("虚拟托盘"));
});
