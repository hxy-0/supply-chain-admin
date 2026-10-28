<script setup lang="ts">
import type { OutboundOrder } from "@/api/wmsOutbound";
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
          label="已拣" /><el-table-column prop="packedQuantity" label="已打板"
      /></el-table>
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
