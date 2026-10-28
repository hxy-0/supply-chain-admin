<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import type {
  Arrival,
  InboundOrder,
  PutawayDetail,
  InboundPallet
} from "@/api/wmsInbound";
import {
  inboundApi,
  inboundStatuses,
  arrivalApi,
  arrivalStatuses
} from "@/api/wmsInbound";
import { formatDateTime } from "@/utils/date";
const props = defineProps<{ order?: InboundOrder }>();
const visible = defineModel<boolean>({ default: false });
const history = ref<PutawayDetail[]>([]);
const pallet = ref<InboundPallet>();
const palletCode = shallowRef("");
const arrivals = ref<Arrival[]>([]);
const arrivalId = shallowRef<string | number>();
const loading = shallowRef(false);
let version = 0;
watch(
  () => [visible.value, props.order?.id] as const,
  async ([open, id]) => {
    const current = ++version;
    history.value = [];
    arrivals.value = [];
    arrivalId.value = undefined;
    pallet.value = undefined;
    palletCode.value = "";
    if (!open || !id) return;
    loading.value = true;
    try {
      const [rows, batches] = await Promise.all([
        inboundApi.putaways(id),
        arrivalApi.page({
          warehouseId: props.order!.warehouseId,
          inboundId: id,
          pageNum: 1,
          pageSize: 100
        })
      ]);
      if (current === version) arrivals.value = batches.records;
      if (current === version) history.value = rows;
    } catch (error) {
      if (current === version)
        ElMessage.error(
          error instanceof Error ? error.message : "记录加载失败"
        );
    } finally {
      if (current === version) loading.value = false;
    }
  }
);
async function lookup() {
  if (!props.order || !arrivalId.value || !palletCode.value.trim()) return;
  pallet.value = undefined;
  try {
    pallet.value = await inboundApi.pallet(
      props.order.id,
      arrivalId.value,
      palletCode.value
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "卡板查询失败");
  }
}
</script>

<template>
  <el-drawer v-model="visible" title="入库详情" size="850px">
    <template v-if="order">
      <h3>{{ order.inboundNo }} · {{ inboundStatuses[order.status] }}</h3>
      <p>
        收货仓：{{ order.warehouseName }} ·
        {{ order.supplierName || "未填写供应商" }}
      </p>
      <p>
        来源：{{ order.sourceType }} / {{ order.sourceNo || "手工入库" }} ·
        交付批次：{{ order.deliveryBatchNo || "未指定" }}
      </p>
      <el-table :data="order.items"
        ><el-table-column prop="sourceLineNo" label="来源行" />
        <el-table-column prop="skuCode" label="SKU" /><el-table-column
          prop="skuName"
          label="商品"
        />
        <el-table-column prop="expectedQuantity" label="应收" /><el-table-column
          prop="receivedQuantity"
          label="已收"
        /><el-table-column prop="putawayQuantity" label="已上架" />
      </el-table>
      <h4>到货批次与来源卡板</h4>
      <el-select
        v-model="arrivalId"
        placeholder="先选到货批次"
        @change="pallet = undefined"
        ><el-option
          v-for="a in arrivals"
          :key="a.id"
          :value="a.id"
          :label="
            a.arrivalNo +
            ' / ' +
            (a.tripNo || '自送') +
            ' / ' +
            arrivalStatuses[a.status]
          "
      /></el-select>
      <el-input
        v-model="palletCode"
        placeholder="输入卡板码查询收货快照与剩余量"
        maxlength="64"
        @keyup.enter="lookup"
        ><template #append
          ><el-button @click="lookup">查询</el-button></template
        ></el-input
      >
      <el-table v-if="pallet" :data="pallet.items">
        <el-table-column prop="skuCode" label="SKU" /><el-table-column
          prop="skuName"
          label="商品"
        />
        <el-table-column prop="receivedQuantity" label="实收" /><el-table-column
          prop="putawayQuantity"
          label="已上架"
        /><el-table-column prop="pendingQuantity" label="待上架" />
      </el-table>
      <h4>实际上架记录</h4>
      <el-table v-loading="loading" :data="history">
        <el-table-column prop="palletCode" label="来源卡板" /><el-table-column
          prop="skuName"
          label="商品"
        />
        <el-table-column prop="locationCode" label="目标库位" /><el-table-column
          prop="quantity"
          label="数量"
          width="70"
        />
        <el-table-column label="时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
      </el-table>
    </template>
  </el-drawer>
</template>
