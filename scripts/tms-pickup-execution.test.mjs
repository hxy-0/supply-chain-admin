import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const calls = [];
let response = { code: 0, data: {} };
globalThis.__executionTransport = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return response;
  }
};
async function api(file) {
  const source = (
    await readFile(new URL(`../src/api/${file}.ts`, import.meta.url), "utf8")
  ).replace(
    'import { http } from "@/utils/http";',
    "const http = globalThis.__executionTransport;"
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext }
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
  );
}
const { pickupExecutionApi } = await api("tmsPickupExecution");
test("management pickup APIs only query facts", async () => {
  assert.deepEqual(Object.keys(pickupExecutionApi).sort(), [
    "containers",
    "detail",
    "page",
    "scan"
  ]);
  await pickupExecutionApi.detail("K/1");
  assert.equal(calls.at(-1).url, "/api/tms/pickup-tasks/K%2F1");
  assert.equal(calls.at(-1).method, "get");
});
test("management trip retains assignment and cancellation without driver operations", async () => {
  const { tripApi } = await api("tmsTransport");
  assert.deepEqual(Object.keys(tripApi).sort(), [
    "assign",
    "cancel",
    "detail",
    "page"
  ]);
  await tripApi.assign("T/1", {
    carrierId: "C",
    vehicleId: "V",
    driverId: "D"
  });
  assert.equal(calls.at(-1).url, "/api/tms/trips/T%2F1/assign");
  assert.equal(calls.at(-1).data.driverId, "D");
});
test("container results retain quantities", async () => {
  response = {
    code: 0,
    data: [{ containerCode: "C1", items: [{ quantity: "99999999999999" }] }]
  };
  const result = await pickupExecutionApi.containers("K");
  assert.equal(result[0].items[0].quantity, "99999999999999");
});
test("authorization errors propagate to caller", async () => {
  response = { code: 1, message: "当前账号不可查询提货任务" };
  await assert.rejects(pickupExecutionApi.detail("K"), /不可查询/);
});
