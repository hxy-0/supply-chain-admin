import assert from "node:assert/strict";
import { test } from "node:test";
import {
  signatures,
  orderAxisValues,
  skuCode,
  renumberSkus
} from "../src/views/pms/products/specifications.ts";
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

test("form attribute order changes code segments and values use dictionary order", () => {
  const axes = [
    { attributeId: 20, valueIds: [202, 201] },
    { attributeId: 10, valueIds: [102, 101] }
  ];
  const values = {
    20: [
      { attributeValueId: 201, valueCode: "BLK", sortOrder: 0 },
      { attributeValueId: 202, valueCode: "WHT", sortOrder: 1 }
    ],
    10: [
      { attributeValueId: 101, valueCode: "M", sortOrder: 0 },
      { attributeValueId: 102, valueCode: "L", sortOrder: 1 }
    ]
  };
  const ordered = orderAxisValues(axes, values);
  const combinations = signatures(ordered);
  assert.deepEqual(combinations, [
    "10=101;20=201",
    "10=102;20=201",
    "10=101;20=202",
    "10=102;20=202"
  ]);
  assert.deepEqual(
    combinations.map((signature, index) =>
      skuCode("P1", signature, ordered, values, index)
    ),
    ["P1-BLK-M-001", "P1-BLK-L-002", "P1-WHT-M-003", "P1-WHT-L-004"]
  );
  const reversed = orderAxisValues([...axes].reverse(), values);
  assert.deepEqual(
    signatures(reversed).map((signature, index) =>
      skuCode("P1", signature, reversed, values, index)
    ),
    ["P1-M-BLK-001", "P1-M-WHT-002", "P1-L-BLK-003", "P1-L-WHT-004"]
  );
  assert.deepEqual(axes[0].valueIds, [202, 201]);
});

test("equal value orders use precise Long IDs without rearranging attributes", () => {
  const axes = [
    { attributeId: 20, valueIds: ["9007199254740993", "9007199254740992"] }
  ];
  assert.deepEqual(orderAxisValues(axes, {})[0].valueIds, [
    "9007199254740992",
    "9007199254740993"
  ]);
});
test("dragging renumbers codes and keeps the specification's business data", () => {
  const black = {
    specSignature: "1=1",
    skuCode: "P1-BLK-001",
    retailPrice: 10,
    barcode: "black",
    images: ["black.png"],
    isDefault: true
  };
  const white = {
    specSignature: "1=2",
    skuCode: "P1-WHT-002",
    retailPrice: 20,
    barcode: "white",
    images: ["white.png"],
    isDefault: false
  };
  const result = renumberSkus([white, black]);
  assert.deepEqual(result, [
    { ...white, skuCode: "P1-WHT-001", sortOrder: 0 },
    { ...black, skuCode: "P1-BLK-002", sortOrder: 1 }
  ]);
  assert.equal(black.skuCode, "P1-BLK-001");
});

test("missing codes and oversized generated codes are rejected", () => {
  assert.equal(skuCode("P1", "", [], {}, 0), "P1-001");
  assert.throws(() => skuCode("", "", [], {}, 0));
  assert.throws(() =>
    skuCode("P1", "1=2", [{ attributeId: 1, valueIds: [2] }], {}, 0)
  );
  assert.throws(() => skuCode("P".repeat(61), "", [], {}, 0));
});
