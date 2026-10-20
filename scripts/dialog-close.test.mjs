import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { ref } from "vue";
import ts from "typescript";

const timers = [];
globalThis.__dialogTest = {
  ref,
  reDialog: {},
  withInstall: value => value,
  useTimeoutFn: callback => timers.push(callback)
};
const source = (
  await readFile(
    new URL("../src/components/ReDialog/index.ts", import.meta.url),
    "utf8"
  )
).replace(/import[\s\S]*?from ["'][^"']+["'];/g, "");
const code = ts.transpileModule(
  "const {ref,reDialog,withInstall,useTimeoutFn} = globalThis.__dialogTest;\n" +
    source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;
const { addDialog, closeDialog, closeAllDialog, dialogStore } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("closing twice calls back once and does not remove the next dialog", () => {
  let closed = 0;
  addDialog({ closeCallBack: () => closed++ });
  addDialog({});
  const first = dialogStore.value[0];
  const second = dialogStore.value[1];
  closeDialog(first, 0);
  closeDialog(first, 0);
  assert.equal(closed, 1);
  timers.shift()();
  closeDialog(first, 0);
  assert.equal(dialogStore.value[0], second);
  closeAllDialog();
});
test("native close removes an already hidden dialog and tolerates route cleanup", () => {
  addDialog({});
  const dialog = dialogStore.value[0];
  dialog.visible = false;
  closeDialog(dialog, 0);
  closeAllDialog();
  assert.doesNotThrow(() => closeDialog(dialog, 0));
  addDialog({});
  timers.shift()();
  assert.equal(dialogStore.value.length, 1);
  closeAllDialog();
});
