const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const exported = {};
new Function("exports", ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/views/tms/order/presentation.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText)(exported);
const order = { orderId: "T1", sourceShipmentId: "S1", items: [{ orderItemId: "L1" }, { orderItemId: "L2" }], pallets: [
  { containerCode: "P1", status: "PACKED", quantities: { L1: 4, L2: 6 } },
  { containerCode: "P2", status: "PACKED", quantities: { L1: 5 } }
] };
assert.deepEqual(exported.palletAllocation([order], ["P1"]), { quantities: { L1: "4", L2: "6" }, packageCounts: { T1: 1 } });
assert.deepEqual(exported.palletAllocation([order], ["P1", "P2"]), { quantities: { L1: "9", L2: "6" }, packageCounts: { T1: 2 } });
assert.deepEqual(exported.palletAllocation([order], []), { quantities: { L1: "", L2: "" }, packageCounts: { T1: 0 } });
const second = { orderId: "T2", sourceShipmentId: "S2", items: [{ orderItemId: "L3" }], pallets: [{ containerCode: "P3", status: "PACKED", quantities: { L3: 8 } }] };
assert.deepEqual(exported.palletAllocation([order, second], ["P1", "P3"]).packageCounts, { T1: 1, T2: 1 });
order.pallets[0].plannedPickupTaskId = "K1";
assert.throws(() => exported.palletAllocation([order], ["P1"]));
console.log("Pallet allocation checks passed: mixed source quantities, one demand split by pallet, consolidation and reservation rejection");
