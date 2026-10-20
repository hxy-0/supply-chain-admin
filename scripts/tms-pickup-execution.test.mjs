import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const calls = [];
let response = { code: 0, data: {} };
globalThis.__executionTransport = { request: async (method, url, options) => {
  calls.push({ method, url, ...options }); return response;
} };
async function api(file) {
  const source = (await readFile(new URL(`../src/api/${file}.ts`, import.meta.url), "utf8"))
    .replace('import { http } from "@/utils/http";', "const http = globalThis.__executionTransport;");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));
}
const { pickupExecutionApi } = await api("tmsPickupExecution");
test("confirm and retry preserve code, task-line identity and exact decimal", async () => {
  const cmd = { containerCode: "C1", containerType: "托盘", items: [{ taskItemId: "I", quantity: "99999999999999.9999" }] };
  await pickupExecutionApi.confirm("K/1", cmd); await pickupExecutionApi.confirm("K/1", cmd);
  assert.equal(calls.at(-1).url, "/api/tms/pickup-tasks/K%2F1/confirm");
  assert.deepEqual(calls.at(-1), calls.at(-2));
  assert.equal(calls.at(-1).data.items[0].quantity, "99999999999999.9999");
  assert.equal(calls.at(-1).data.weightKg, undefined);
});
test("finish sends independent per-line reasons without client-calculated shortage", async () => {
  await pickupExecutionApi.finish("K", { items: [{ taskItemId: "I1", shortageReason: "供应商少备" }, { taskItemId: "I2" }] });
  assert.equal(calls.at(-1).url, "/api/tms/pickup-tasks/K/finish");
  assert.equal(calls.at(-1).data.items[0].shortageQuantity, undefined);
  assert.equal(calls.at(-1).data.items[1].shortageReason, undefined);
});
test("container results retain facts as decimal strings", async () => {
  response = { code: 0, data: [{ containerCode: "C1", items: [{ quantity: "0.0001" }] }] };
  const result = await pickupExecutionApi.containers("K");
  assert.equal(result[0].items[0].quantity, "0.0001");
});
test("authorization and already-confirmed content errors propagate to caller", async () => {
  response = { code: 1, message: "当前账号不可执行运输作业" };
  await assert.rejects(pickupExecutionApi.detail("K"), /不可执行运输作业/);
  response = { code: 1, message: "容器码已使用，不能更换任务、包装或实提明细" };
  await assert.rejects(pickupExecutionApi.confirm("K", {}), /不能更换任务/);
});
