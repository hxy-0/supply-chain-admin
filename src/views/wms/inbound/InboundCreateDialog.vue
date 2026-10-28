<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import { pmsRequest } from "@/api/pms";
import type { Id } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { warehouseApi } from "@/api/wms";
import type { Warehouse } from "@/api/wms";
import { inboundApi, sourceTypes } from "@/api/wmsInbound";

const emit = defineEmits<{ saved: [] }>();
const visible = defineModel<boolean>({ default: false });
const busy = shallowRef(false);
const warehouseId = shallowRef<Id>();
const supplierName = shallowRef("");
const sourceType = shallowRef("MANUAL");
const sourceNo = shallowRef("");
const deliveryBatchNo = shallowRef("");
const sourceLineNo = shallowRef("");
const skuId = shallowRef<Id>();
const quantity = shallowRef(1);
const warehouseOptions = ref<Warehouse[]>([]);
const skuOptions = ref<{ sku: { skuId: Id; skuCode: string; name: string } }[]>(
  []
);
const lines = reactive<
  { sourceLineNo: string; skuId: Id; label: string; expectedQuantity: number }[]
>([]);
async function warehouses(name = "") {
  try {
    warehouseOptions.value = (
      await warehouseApi.page({ name, status: 0, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
}
async function skus(skuCode = "") {
  try {
    skuOptions.value = (
      await pmsRequest<
        PageResult<{ sku: { skuId: Id; skuCode: string; name: string } }>
      >("get", "/skus", undefined, {
        skuCode,
        isEnable: 1,
        pageNum: 1,
        pageSize: 50
      })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "商品加载失败");
  }
}
function add() {
  const sku = skuOptions.value.find(
    row => String(row.sku.skuId) === String(skuId.value)
  )?.sku;
  if (!sku || !Number.isInteger(quantity.value) || quantity.value <= 0) {
    ElMessage.error("请选择商品并输入正整数应收数量");
    return;
  }
  if (
    !sourceLineNo.value.trim() ||
    lines.some(line => line.sourceLineNo === sourceLineNo.value.trim())
  ) {
    ElMessage.error("请填写不重复的来源行号，同一商品不同来源行可分别添加");
    return;
  }
  lines.push({
    sourceLineNo: sourceLineNo.value.trim(),
    skuId: sku.skuId,
    label: `${sku.skuCode} · ${sku.name}`,
    expectedQuantity: quantity.value
  });
}
async function save() {
  if (!warehouseId.value || !lines.length) {
    ElMessage.error("请选择仓库并添加商品");
    return;
  }
  busy.value = true;
  try {
    await inboundApi.create({
      warehouseId: warehouseId.value,
      supplierName: supplierName.value,
      sourceType: sourceType.value,
      sourceNo: sourceNo.value.trim(),
      deliveryBatchNo: deliveryBatchNo.value.trim(),
      items: lines.map(line => ({
        sourceLineNo: line.sourceLineNo,
        skuId: line.skuId,
        expectedQuantity: line.expectedQuantity
      }))
    });
    visible.value = false;
    emit("saved");
    ElMessage.success("入库单已创建，请在小程序按卡板收货");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  } finally {
    busy.value = false;
  }
}
function opened() {
  lines.splice(0);
  warehouseId.value = undefined;
  supplierName.value = "";
  sourceType.value = "MANUAL";
  sourceNo.value = "";
  deliveryBatchNo.value = "";
  sourceLineNo.value = "1";
  skuId.value = undefined;
  quantity.value = 1;
  void warehouses();
  void skus();
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="创建入库单"
    size="560px"
    :close-on-click-modal="false"
    :before-close="
      done => {
        if (!busy) done();
      }
    "
    destroy-on-close
    @open="opened"
  >
    <el-form label-width="90px">
      <el-form-item label="入库仓库">
        <el-select
          v-model="warehouseId"
          filterable
          remote
          :remote-method="warehouses"
          placeholder="搜索启用仓库"
        >
          <el-option
            v-for="warehouse in warehouseOptions"
            :key="warehouse.id"
            :value="warehouse.id"
            :label="warehouse.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="来源类型"
        ><el-select v-model="sourceType"
          ><el-option
            v-for="option in sourceTypes"
            :key="option.value"
            :label="option.label"
            :value="option.value" /></el-select
      ></el-form-item>
      <el-form-item label="来源单号"
        ><el-input
          v-model="sourceNo"
          maxlength="64"
          placeholder="采购、调拨、退货单号；手工入库可不填"
      /></el-form-item>
      <el-form-item label="交付批次"
        ><el-input
          v-model="deliveryBatchNo"
          maxlength="64"
          placeholder="计划交付批次，可不填"
      /></el-form-item>
      <el-form-item label="来源行号"
        ><el-input
          v-model="sourceLineNo"
          maxlength="64"
          placeholder="原单行号，手工入库填本单行号"
      /></el-form-item>
      <el-form-item label="供应商"
        ><el-input v-model="supplierName" maxlength="128"
      /></el-form-item>
      <el-form-item label="商品">
        <el-select
          v-model="skuId"
          filterable
          remote
          :remote-method="skus"
          placeholder="输入 SKU 编码搜索"
          style="width: 340px"
        >
          <el-option
            v-for="row in skuOptions"
            :key="row.sku.skuId"
            :value="row.sku.skuId"
            :label="row.sku.skuCode + ' · ' + row.sku.name"
          />
        </el-select>
        <el-input-number
          v-model="quantity"
          :min="1"
          :max="2147483647"
          :precision="0"
        />
        <el-button @click="add">添加</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="lines">
      <el-table-column prop="sourceLineNo" label="来源行" />
      <el-table-column prop="label" label="商品" />
      <el-table-column label="应收数量" width="200"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.expectedQuantity"
            :min="1"
            :max="2147483647"
            :precision="0" /></template
      ></el-table-column>
      <el-table-column width="80"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="lines.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <template #footer
      ><el-button :disabled="busy" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >创建</el-button
      ></template
    >
  </el-drawer>
</template>
