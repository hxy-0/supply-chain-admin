import assert from "node:assert/strict";
import { test } from "node:test";
import { signatures } from "../src/views/pms/products/specifications.ts";
test("default SKU has empty signature", () =>
  assert.deepEqual(signatures([]), [""]));
test("attribute order does not change identity", () =>
  assert.deepEqual(
    signatures([
      { attributeId: 13, valueIds: [205] },
      { attributeId: 12, valueIds: [101, 102] }
    ]),
    ["12=101;13=205", "12=102;13=205"]
  ));
test("duplicate axes, missing values and excessive combinations are rejected", () => {
  assert.throws(() => signatures([{ attributeId: 1, valueIds: [] }]));
  assert.throws(() =>
    signatures([
      { attributeId: 1, valueIds: [1] },
      { attributeId: 1, valueIds: [2] }
    ])
  );
  assert.throws(() =>
    signatures(
      [
        { attributeId: 1, valueIds: [1, 2] },
        { attributeId: 2, valueIds: [1, 2] }
      ],
      3
    )
  );
});

test("invalid identifiers cannot produce a default or malformed SKU", () => {
  assert.throws(() => signatures([{ attributeId: "", valueIds: [1] }]));
  assert.throws(() => signatures([{ attributeId: 1, valueIds: [null] }]));
  assert.throws(() => signatures([{ attributeId: -1, valueIds: [1] }]));
});
test("large Long identifiers preserve precision", () =>
  assert.deepEqual(
    signatures([
      { attributeId: "9007199254740993", valueIds: ["9007199254740995"] }
    ]),
    ["9007199254740993=9007199254740995"]
  ));
