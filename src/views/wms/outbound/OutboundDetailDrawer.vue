<script setup lang="ts">
import type { OutboundOrder } from "@/api/wmsOutbound";
import { formatDateTime } from "@/utils/date";
import { outboundStatuses } from "@/api/wmsOutbound";
import { ref, shallowRef } from "vue";
import WmsLabelDialog, {
  type WarehouseLabel
} from "../components/WmsLabelDialog.vue";
const labels = ref<WarehouseLabel[]>([]);
const printOpen = shallowRef(false);
function printPallets() {
  labels.value = (props.order?.pallets || []).map(pallet => ({
    code: pallet.containerCode,
    title: `卡板 ${pallet.containerCode}`,
    subtitle: `${pallet.originNodeName} → ${pallet.destinationNodeName}`,
    lines: pallet.products.map(
      product => `${product.skuCode || product.goodsName} × ${product.quantity}`
    )
  }));
  printOpen.value = true;
}
const props = defineProps<{ order?: OutboundOrder }>();
const visible = defineModel<boolean>({ default: false });
</script>
<template>
  <el-drawer v-model="visible" title="出库详情" size="850px">
    <template v-if="props.order">
      <h3>{{ order!.outboundNo }} · {{ outboundStatuses[order!.status] }}</h3>
      <p>
        {{ order!.warehouseName }} → {{ order!.destinationNodeName }} · 按单摘果
      </p>
      <el-table :data="order!.items"
        ><el-table-column prop="skuCode" label="SKU" /><el-table-column
          prop="skuName"
          label="商品" /><el-table-column
          prop="quantity"
          label="应出" /><el-table-column
          prop="pickedQuantity"
          label="已拣" /><el-table-column
          prop="packedQuantity"
          label="已打板" /><el-table-column
          prop="shippedQuantity"
          label="已发运"
      /></el-table>
      <h4>发运批次（{{ order!.shipments.length }}）</h4>
      <p>
        备妥后可安排运输；小程序逐板核对交接后扣库存。支持跨单混板、合并待运及按板分车交接。
      </p>
      <el-table :data="order!.shipments">
        <el-table-column prop="shipmentNo" label="批次号" min-width="180" />
        <el-table-column label="状态"
          ><template #default="{ row }">{{
            row.status === "READY"
              ? "待交接"
              : row.status === "PARTIALLY_SHIPPED"
                ? "部分交接"
                : "全部交接"
          }}</template></el-table-column
        >
        <el-table-column label="原卡板" min-width="180"
          ><template #default="{ row }">{{
            row.palletCodes.join("、")
          }}</template></el-table-column
        >
        <el-table-column label="备妥时间" min-width="170"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="交接时间" min-width="170"
          ><template #default="{ row }">{{
            formatDateTime(row.shippedTime)
          }}</template></el-table-column
        >
      </el-table>
      <h4>拣货库位</h4>
      <el-table :data="order!.allocations"
        ><el-table-column prop="locationCode" label="库位" /><el-table-column
          prop="skuCode"
          label="SKU" /><el-table-column
          prop="skuName"
          label="商品" /><el-table-column prop="quantity" label="数量"
      /></el-table>
      <h4>已生成卡板（{{ order!.pallets.length }}）</h4>
      <el-button :disabled="!order!.pallets.length" @click="printPallets"
        >打印卡板标签</el-button
      >
      <el-card
        v-for="pallet in order!.pallets"
        :key="pallet.containerId"
        shadow="never"
        style="margin-bottom: 12px"
      >
        <h4>{{ pallet.containerCode }}</h4>
        <p>
          {{ pallet.originNodeName }} →
          {{ pallet.destinationNodeName }}
        </p>
        <el-table :data="pallet.products"
          ><el-table-column prop="skuCode" label="SKU" /><el-table-column
            prop="goodsName"
            label="商品" /><el-table-column prop="quantity" label="数量"
        /></el-table>
      </el-card>
    </template>
  </el-drawer>
  <WmsLabelDialog v-model="printOpen" :labels="labels" />
</template>
