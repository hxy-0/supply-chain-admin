<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import { pmsRequest } from "@/api/pms";
import type { Id } from "@/api/pms";
import { logisticNodeApi, type LogisticNode, type PageResult } from "@/api/tms";
import { warehouseApi } from "@/api/wms";
import type { Warehouse } from "@/api/wms";
import { outboundApi } from "@/api/wmsOutbound";

const emit = defineEmits<{ saved: [] }>();
const visible = defineModel<boolean>({ default: false });
const busy = shallowRef(false);
const warehouseId = shallowRef<Id>();
const destinationNodeId = shallowRef<string>();
const orderNo = shallowRef("");
const skuId = shallowRef<Id>();
const quantity = shallowRef(1);
const warehouseOptions = ref<Warehouse[]>([]);
const destinationNodes = ref<LogisticNode[]>([]);
const skuOptions = ref<{ sku: { skuId: Id; skuCode: string; name: string } }[]>(
  []
);
const lines = reactive<{ skuId: Id; label: string; quantity: number }[]>([]);
async function warehouses(name = "") {
  try {
    warehouseOptions.value = (
      await warehouseApi.page({ name, status: 0, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
}
async function nodes(name = "") {
  try {
    destinationNodes.value = (
      await logisticNodeApi.page({ name, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "物流节点加载失败"
    );
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
    ElMessage.error("请选择商品并输入正整数出库数量");
    return;
  }
  if (lines.some(line => String(line.skuId) === String(sku.skuId))) {
    ElMessage.error("商品已添加，请直接修改数量");
    return;
  }
  lines.push({
    skuId: sku.skuId,
    label: `${sku.skuCode} · ${sku.name}`,
    quantity: quantity.value
  });
}
async function save() {
  if (
    !warehouseId.value ||
    !destinationNodeId.value ||
    !lines.length ||
    warehouseOptions.value.find(
      row => String(row.id) === String(warehouseId.value)
    )?.logisticNodeId === destinationNodeId.value
  ) {
    ElMessage.error("请选择出库仓库、不同的收货节点并添加商品");
    return;
  }
  busy.value = true;
  try {
    await outboundApi.create({
      warehouseId: warehouseId.value,
      destinationNodeId: destinationNodeId.value,
      orderNo: orderNo.value,
      items: lines.map(line => ({
        skuId: line.skuId,
        quantity: line.quantity
      }))
    });
    visible.value = false;
    emit("saved");
    ElMessage.success("出库单已创建，分配后请在小程序拣货打板");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  } finally {
    busy.value = false;
  }
}
function opened() {
  lines.splice(0);
  warehouseId.value = undefined;
  destinationNodeId.value = undefined;
  orderNo.value = "";
  skuId.value = undefined;
  quantity.value = 1;
  void warehouses();
  void nodes();
  void skus();
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="创建出库单"
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
      <el-form-item label="始发仓">
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
      <el-form-item label="收货节点" required>
        <el-select
          v-model="destinationNodeId"
          filterable
          remote
          :remote-method="nodes"
          placeholder="搜索收货物流节点（含外部地点）"
        >
          <el-option
            v-for="node in destinationNodes"
            :key="node.id"
            :value="node.id"
            :label="node.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务单号"
        ><el-input
          v-model="orderNo"
          maxlength="64"
          placeholder="可选，同一业务单只能创建一个出库单"
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
      <el-table-column prop="label" label="商品" />
      <el-table-column label="出库数量" width="200"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.quantity"
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
