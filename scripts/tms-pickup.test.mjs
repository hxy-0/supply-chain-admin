import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const calls = [];
let response = { code: 0, data: {} };
globalThis.__pickupTransport = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return response;
  }
};
const source = (
  await readFile(new URL("../src/api/tmsPickup.ts", import.meta.url), "utf8")
).replace(
  'import { http } from "@/utils/http";',
  "const http = globalThis.__pickupTransport;"
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { pickupApi } = await import(
  "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
);
test("batch trip generation preserves exact quantities and selected warehouse using order pickup metadata", async () => {
  await pickupApi.generateTrip({
    orderIds: ["O1", "O2"],
    transportOrganizationType: "TRANSFER",
    transferNodeId: "W",
    carrierId: "C",
    orderPickups: [
      { orderId: "O1", plannedPackageCount: 12 },
      { orderId: "O2", plannedPackageCount: 3 }
    ],
    stops: [
      {
        nodeId: "P",
        pickup: true,
        plannedArrivalTime: 100,
        plannedDepartureTime: 200
      },
      { nodeId: "W", pickup: false, plannedArrivalTime: 300 }
    ],
    items: [{ orderItemId: "L", plannedQuantity: "99999999999999" }]
  });
  const call = calls.at(-1);
  assert.equal(call.url, "/api/tms/orders/generate-trip");
  assert.deepEqual(call.data.orderIds, ["O1", "O2"]);
  assert.equal(call.data.items[0].plannedQuantity, "99999999999999");
  assert.equal(call.data.transferNodeId, "W");
  assert.equal(call.data.plannedWeightKg, undefined);
  assert.equal(call.data.planId, undefined);
  assert.equal(call.data.pickupNodeId, undefined);
  assert.equal(call.data.stops[0].plannedDepartureTime, 200);
  assert.equal(call.data.stops[0].pickup, true);
  assert.equal(call.data.stops[1].pickup, false);
  assert.deepEqual(call.data.orderPickups, [
    { orderId: "O1", plannedPackageCount: 12 },
    { orderId: "O2", plannedPackageCount: 3 }
  ]);
});
test("pickup cancellation operates directly on the task", async () => {
  await pickupApi.cancel("K/1");
  assert.equal(calls.at(-1).url, "/api/tms/pickup-tasks/K%2F1/cancel");
});
test("failed reservations are propagated without a successful response", async () => {
  response = { code: 1, message: "超过订单行可预留数量" };
  await assert.rejects(pickupApi.generateTrip({}), /超过订单行可预留数量/);
});
