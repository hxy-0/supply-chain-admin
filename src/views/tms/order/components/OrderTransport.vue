<script setup lang="ts">
import { ref, watch } from "vue";
import { orderApi, type OrderTransport } from "@/api/tmsOrder";
import { formatDateTime } from "@/utils/date";

const props = defineProps<{ orderId: string }>();
const rows = ref<OrderTransport[]>([]);
const loading = ref(false);
const error = ref("");
let version = 0;
const statuses: Record<string, string> = {
  PENDING: "待派车",
  WAITING_LOADING: "待装车",
  WAITING_DEPARTURE: "待发车",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const segmentStatuses: Record<string, string> = {
  RESERVED: "已预留",
  LOADED: "已装车",
  UNLOADED: "已卸货",
  CANCELLED: "已取消"
};
async function load() {
  const current = ++version;
  rows.value = [];
  loading.value = true;
  error.value = "";
  try {
    const result = await orderApi.transport(props.orderId);
    if (current === version) rows.value = result;
  } catch (reason) {
    if (current === version)
      error.value =
        reason instanceof Error ? reason.message : "运输轨迹加载失败";
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(() => props.orderId, load, { immediate: true });
</script>

<template>
  <h4 class="my-4">容器运输轨迹</h4>
  <p class="mb-3 text-sm text-(--el-text-color-secondary)">
    每行对应一个商品在一个容器运输段中的记录；各段数量不累加，最终仓卸货才计入完成。
  </p>
  <el-alert v-if="error" :title="error" type="error" :closable="false">
    <el-button link type="primary" @click="load">重试</el-button>
  </el-alert>
  <el-table
    v-else
    v-loading="loading"
    :data="rows"
    border
    empty-text="尚无实提容器"
  >
    <el-table-column
      prop="containerCode"
      label="容器码"
      min-width="190"
      fixed
    />
    <el-table-column prop="goodsName" label="商品" min-width="130" />
    <el-table-column prop="quantity" label="本容器数量" width="120" />
    <el-table-column prop="unit" label="单位" width="70" />
    <el-table-column prop="tripNo" label="车次" min-width="200">
      <template #default="{ row }">{{ row.tripNo || "尚未绑定车次" }}</template>
    </el-table-column>
    <el-table-column label="车次状态" width="120">
      <template #default="{ row }">{{
        statuses[row.tripStatus] || "—"
      }}</template>
    </el-table-column>
    <el-table-column label="本段状态" width="110">
      <template #default="{ row }">{{
        segmentStatuses[row.segmentStatus] || "—"
      }}</template>
    </el-table-column>
    <el-table-column prop="carrierName" label="承运人" min-width="130" />
    <el-table-column prop="loadNodeName" label="装货节点" min-width="130" />
    <el-table-column prop="unloadNodeName" label="卸货节点" min-width="130" />
    <el-table-column
      v-for="column in [
        ['pickedTime', '初始实提'],
        ['reservedTime', '绑定车次'],
        ['loadedTime', '装车'],
        ['departedTime', '发车'],
        ['arrivedTime', '指定点签到'],
        ['unloadedTime', '卸货']
      ]"
      :key="column[0]"
      :label="column[1]"
      width="180"
    >
      <template #default="{ row }">{{
        formatDateTime(row[column[0]])
      }}</template>
    </el-table-column>
    <el-table-column prop="receivedQuantity" label="本段卸货数量" width="130" />
    <el-table-column
      prop="completedQuantity"
      label="本段最终交付"
      width="130"
    />
  </el-table>
</template>
