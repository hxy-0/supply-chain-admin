<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  inventoryApi,
  storageApi,
  WmsBusinessError,
  type Inventory,
  type Location,
  type Transfer
} from "@/api/wmsInventory";
import { useUserStoreHook } from "@/store/modules/user";
const props = defineProps<{ source?: Inventory }>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [] }>();
const key = `wms-transfer-pending:${useUserStoreHook().username}`;
const busy = shallowRef(false),
  barcode = shallowRef(""),
  quantity = shallowRef(1);
const target = ref<Location>();
const pending = ref<Transfer>();
watch(visible, open => {
  if (!open) {
    return;
  }
  target.value = undefined;
  barcode.value = "";
  quantity.value = 1;
  try {
    pending.value =
      JSON.parse(sessionStorage.getItem(key) || "null") || undefined;
  } catch {
    pending.value = undefined;
    sessionStorage.removeItem(key);
  }
  if (pending.value) {
    quantity.value = pending.value.quantity;
    barcode.value = pending.value.targetLocationBarcode;
  }
});
watch([barcode, quantity], () => {
  if (!pending.value) {
    target.value = undefined;
  }
});
async function confirmLocation() {
  if (!props.source || busy.value) {
    return;
  }
  target.value = undefined;
  busy.value = true;
  try {
    target.value = await storageApi.scan(
      props.source.warehouseId,
      barcode.value.trim()
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "库位解析失败");
  } finally {
    busy.value = false;
  }
}
async function submit() {
  if (busy.value) {
    return;
  }
  if (!pending.value) {
    if (
      !props.source ||
      !target.value ||
      !Number.isInteger(quantity.value) ||
      quantity.value < 1 ||
      quantity.value > props.source.availableQuantity
    ) {
      ElMessage.error("请确认数量和实际目标库位");
      return;
    }
    pending.value = {
      warehouseId: props.source.warehouseId,
      skuId: props.source.skuId,
      quantity: quantity.value,
      sourceLocationBarcode: props.source.locationBarcode,
      targetLocationBarcode: target.value.barcode,
      requestId: crypto.randomUUID()
    };
    sessionStorage.setItem(key, JSON.stringify(pending.value));
  }
  busy.value = true;
  try {
    const no = await inventoryApi.transfer(pending.value);
    sessionStorage.removeItem(key);
    pending.value = undefined;
    visible.value = false;
    emit("saved");
    ElMessage.success(`移库成功：${no}`);
  } catch (error) {
    if (error instanceof WmsBusinessError) {
      sessionStorage.removeItem(key);
      pending.value = undefined;
    }
    ElMessage.error(
      error instanceof Error ? error.message : "请求结果未确认，请重试原请求"
    );
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    title="库内移库"
    width="520px"
    :show-close="!pending && !busy"
    :close-on-click-modal="!pending && !busy"
    :close-on-press-escape="!pending && !busy"
  >
    <el-alert
      v-if="pending"
      title="上次请求结果尚未确认，重试将使用原请求号与原内容。"
      type="warning"
      :closable="false"
    />
    <p v-if="pending">
      商品ID：{{ pending.skuId }} · 原库位码：{{
        pending.sourceLocationBarcode
      }}
    </p>
    <p v-else>
      {{ source?.skuCode }} · {{ source?.skuName }}<br />{{
        source?.warehouseName
      }}
      / {{ source?.locationCode }} · 可移动 {{ source?.availableQuantity }}
    </p>
    <el-form label-width="110px" :disabled="busy || !!pending">
      <el-form-item label="移库数量"
        ><el-input-number
          v-model="quantity"
          :min="1"
          :max="source?.availableQuantity"
          :precision="0"
      /></el-form-item>
      <el-form-item label="实际库位码"
        ><el-input
          v-model="barcode"
          placeholder="扫描目标库位条码或二维码"
          @keyup.enter="confirmLocation"
      /></el-form-item>
      <el-form-item
        ><el-button @click="confirmLocation"
          >确认目标库位</el-button
        ></el-form-item
      >
    </el-form>
    <p v-if="target">目标：{{ target.zoneName }} / {{ target.code }}</p>
    <template #footer
      ><el-button :disabled="busy || !!pending" @click="visible = false"
        >取消</el-button
      ><el-button
        type="primary"
        :loading="busy"
        :disabled="!pending && !target"
        @click="submit"
        >{{ pending ? "重试原请求" : "提交移库" }}</el-button
      ></template
    >
  </el-dialog>
</template>
