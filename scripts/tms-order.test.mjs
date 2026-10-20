import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const calls = [];
let response = { code: 0, data: {} };
globalThis.__orderTransport = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return response;
  }
};
const source = (
  await readFile(new URL("../src/api/tmsOrder.ts", import.meta.url), "utf8")
).replace(
  'import { http } from "@/utils/http";',
  "const http = globalThis.__orderTransport;"
);
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { orderApi } = await import(
  "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
);

test("new order requests preserve integer quantities and optional references", async () => {
  const command = {
    destinationNodeId: "D",
    destinationAddress: "目的地",
    receiverName: "收货员",
    receiverPhone: "13800000000",
    items: [
      {
        goodsSource: "MANUAL",
        goodsName: "货物",
        orderedQuantity: "99999999999999",
        unit: "件"
      }
    ]
  };
  await orderApi.create(command);
  assert.equal(calls.at(-1).url, "/api/tms/orders");
  assert.equal(calls.at(-1).data.items[0].orderedQuantity, "99999999999999");
  assert.equal(calls.at(-1).data.items[0].weightKg, undefined);
});

test("pickup metadata is saved to the order without rewriting goods", async () => {
  await orderApi.updatePickupPlan("O/1", {
    version: 7,
    pickupNodeId: "P",
    pickupAddress: "提货地址",
    senderName: "发货员",
    senderPhone: "13800000001",
    expectPickupTime: 100,
    plannedPackageCount: 2
  });
  const call = calls.at(-1);
  assert.equal(call.method, "put");
  assert.equal(call.url, "/api/tms/orders/O%2F1/pickup-plan");
  assert.equal(call.data.version, 7);
  assert.equal(call.data.plannedPackageCount, 2);
  assert.equal(call.data.items, undefined);
});

test("editing preserves version and order-line identity", async () => {
  await orderApi.update("O/1", {
    version: 7,
    items: [{ orderItemId: "L1", orderedQuantity: "5" }]
  });
  assert.equal(calls.at(-1).method, "put");
  assert.equal(calls.at(-1).url, "/api/tms/orders/O%2F1");
  assert.equal(calls.at(-1).data.version, 7);
  assert.equal(calls.at(-1).data.items[0].orderItemId, "L1");
});

test("order page submits multiple statuses and an empty selection clears the filter", async () => {
  await orderApi.page({ statuses: ["EXECUTING", "DELIVERED"], pageNum: 1 });
  assert.deepEqual(calls.at(-1).data.statuses, ["EXECUTING", "DELIVERED"]);
  await orderApi.page({ statuses: [], pageNum: 1 });
  assert.deepEqual(calls.at(-1).data.statuses, []);
});

test("cancellation and difference close carry independent immutable reasons", async () => {
  await orderApi.cancel("O1", "客户取消");
  assert.equal(calls.at(-1).url, "/api/tms/orders/O1/cancel");
  assert.deepEqual(calls.at(-1).data, { reason: "客户取消" });
  await orderApi.close("O1", "供应商少备");
  assert.equal(calls.at(-1).url, "/api/tms/orders/O1/close");
  assert.deepEqual(calls.at(-1).data, { reason: "供应商少备" });
});

test("backend rejections cannot be presented as successful operations", async () => {
  response = { code: 1, message: "尚有在途商品" };
  await assert.rejects(orderApi.close("O1", "少备"), /尚有在途商品/);
  response = { code: 0, data: { items: [{ orderedQuantity: "1" }] } };
  assert.equal((await orderApi.detail("O1")).items[0].orderedQuantity, "1");
});

test("transport preserves order identity and exact quantities and propagates access errors", async () => {
  response = {
    code: 0,
    data: [{ quantity: "99999999999999", completedQuantity: "0" }]
  };
  const rows = await orderApi.transport("O/1");
  assert.equal(calls.at(-1).method, "get");
  assert.equal(calls.at(-1).url, "/api/tms/orders/O%2F1/transport");
  assert.equal(rows[0].quantity, "99999999999999");
  response = { code: 403, message: "禁止查看运输事实" };
  await assert.rejects(orderApi.transport("O1"), /禁止查看运输事实/);
});

const presentationSource = await readFile(
  new URL("../src/views/tms/order/presentation.ts", import.meta.url),
  "utf8"
);
const presentationJS = ts.transpileModule(presentationSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const {
  availablePickupQuantity,
  pickupAllocationError,
  statusLabels,
  validQuantity,
  validMeasurement,
  sortedPickupOrders,
  buildOrderTripRoute,
  tripRouteError
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(presentationJS).toString("base64")
);
test("allocation rejects excessive quantities and allows partial allocation", () => {
  assert.equal(pickupAllocationError("100", "60", "40"), "");
  assert.match(
    pickupAllocationError("100", "60", "41"),
    /剩余可分配数量（40）/
  );
  assert.match(pickupAllocationError("30", "30", "1"), /剩余可分配数量（0）/);
  assert.match(pickupAllocationError("100", "0", "0"), /正整数/);
  assert.match(pickupAllocationError("100", "0", "1.5"), /正整数/);
  assert.equal(
    pickupAllocationError("99999999999999", "1", "99999999999998"),
    ""
  );
});

test("trip defaults and validation use integer goods quantities", () => {
  assert.equal(
    availablePickupQuantity("99999999999999", "1"),
    "99999999999998"
  );
  assert.equal(availablePickupQuantity("100", "61"), "39");
  assert.equal(availablePickupQuantity("5", "5"), "0");
  assert.equal(availablePickupQuantity("5", "6"), "0");
  assert.equal(availablePickupQuantity("5"), "5");
  assert.equal(validQuantity("1.5", true), false);
  assert.equal(validQuantity("1", true), true);
  assert.equal(validQuantity("0", true), false);
  assert.equal(validMeasurement("1.25"), true);
});
test("pickup itinerary ignores selection order and sorts by planned time with stable ties", () => {
  const input = [
    { orderId: "B", expectPickupTime: 200 },
    { orderId: "C", expectPickupTime: 100 },
    { orderId: "A", expectPickupTime: 100 }
  ];
  assert.deepEqual(
    sortedPickupOrders(input).map(order => order.orderId),
    ["A", "C", "B"]
  );
  assert.equal(input[0].orderId, "B");
});
test("every final order status has a display label", () => {
  assert.deepEqual(
    Object.values(statusLabels).sort(),
    ["待提货", "运输中", "已送达", "已完成", "已取消"].sort()
  );
});

test("order route defaults include pickup and delivery times and validate edits", () => {
  const orders = [
    {
      orderId: "O2",
      pickupNodeId: "B",
      destinationNodeId: "D",
      expectPickupTime: 200,
      expectDeliveryTime: 400
    },
    {
      orderId: "O1",
      pickupNodeId: "A",
      destinationNodeId: "D",
      expectPickupTime: 100,
      expectDeliveryTime: 400
    }
  ];
  const route = buildOrderTripRoute(orders);
  assert.deepEqual(
    route.map(stop => stop.nodeId),
    ["A", "B", "D"]
  );
  assert.equal(route[2].plannedArrivalTime, 400);
  assert.equal(tripRouteError(route, orders, ["D"]), undefined);
  route[0].plannedDepartureTime = 300;
  assert.equal(tripRouteError(route, orders, ["D"]), undefined);
  route[0].plannedDepartureTime = 100;
  route[1].nodeId = "FOREIGN";
  assert.match(tripRouteError(route, orders, ["D"]), /提货点/);
});

test("same pickup node aggregates orders and preserves one delivery stop per destination", () => {
  const orders = [
    {
      orderId: "O1",
      pickupNodeId: "A",
      destinationNodeId: "D",
      expectPickupTime: 100,
      expectDeliveryTime: 400
    },
    {
      orderId: "O2",
      pickupNodeId: "A",
      destinationNodeId: "D",
      expectPickupTime: 200,
      expectDeliveryTime: 400
    },
    {
      orderId: "O3",
      pickupNodeId: "B",
      destinationNodeId: "E",
      expectPickupTime: 300,
      expectDeliveryTime: 500
    }
  ];
  const route = buildOrderTripRoute(orders);
  assert.deepEqual(
    route.map(stop => stop.nodeId),
    ["A", "B", "D", "E"]
  );
  assert.equal(tripRouteError(route, orders, ["D", "E"]), undefined);
  route.splice(1, 0, { ...route[0] });
  assert.match(tripRouteError(route, orders, ["D", "E"]), /提货点/);
});

test("node plan times span aggregated orders and allow conflicts between consecutive nodes", () => {
  const orders = [
    {
      orderId: "O1",
      pickupNodeId: "A",
      destinationNodeId: "D",
      expectPickupTime: 100,
      expectDeliveryTime: 500
    },
    {
      orderId: "O2",
      pickupNodeId: "A",
      destinationNodeId: "D",
      expectPickupTime: 300,
      expectDeliveryTime: 800
    },
    {
      orderId: "O3",
      pickupNodeId: "B",
      destinationNodeId: "E",
      expectPickupTime: 200,
      expectDeliveryTime: 400
    }
  ];
  const route = buildOrderTripRoute(orders);
  assert.equal(route[0].plannedArrivalTime, 100);
  assert.equal(route[0].plannedDepartureTime, 300);
  assert.equal(route[1].plannedArrivalTime, 200);
  assert.equal(route[2].plannedArrivalTime, 500);
  assert.equal(route[2].plannedDepartureTime, 800);
  assert.equal(tripRouteError(route, orders, ["D", "E"]), undefined);
  const transfer = buildOrderTripRoute(orders, { id: "W", name: "warehouse" });
  assert.equal(transfer.at(-1).plannedArrivalTime, 400);
  assert.equal(transfer.at(-1).plannedDepartureTime, 800);
  route[0].plannedDepartureTime = 99;
  assert.match(tripRouteError(route, orders, ["D", "E"]), /同一节点/);
});
