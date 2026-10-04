import test from "node:test";
import assert from "node:assert/strict";
import { canDrop, changedOrders, siblingOrders } from "../src/views/system/menu/utils/ordering.ts";

test("dragging changes sibling order without changing hierarchy", () => {
  const tree = [{ id: 1, title: "目录", children: [
    { id: 2, parentId: 1, title: "品牌" },
    { id: 3, parentId: 1, title: "商品" }
  ] }];
  const original = siblingOrders(tree);
  assert.deepEqual(changedOrders(tree, original), []);
  tree[0].children.reverse();
  assert.deepEqual(changedOrders(tree, original), [
    { parentId: 1, ids: [3, 2], expectedIds: [2, 3] }
  ]);
});

test("reject moving a menu into a directory or across parents", () => {
  const source = { id: 2, parentId: 1, title: "品牌" };
  assert.equal(canDrop(source, { id: 3, parentId: 1, title: "商品" }, "next"), true);
  assert.equal(canDrop(source, { id: 3, parentId: 1, title: "商品" }, "inner"), false);
  assert.equal(canDrop(source, { id: 4, parentId: 9, title: "用户" }, "prev"), false);
});

test("home stays first", () => {
  const home = { id: 1, title: "首页", name: "Home", parentId: 0 };
  const source = { id: 2, title: "商品", parentId: 0 };
  assert.equal(canDrop(source, home, "prev"), false);
  assert.equal(canDrop(source, home, "next"), true);
  assert.equal(canDrop(home, source, "next"), false);
});
