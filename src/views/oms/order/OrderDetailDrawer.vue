<script setup lang="ts">
import { computed } from "vue";
import { orderStatuses, type OmsOrder } from "@/api/oms";
import { formatDateTime } from "@/utils/date";
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ order?: OmsOrder }>();
defineEmits<{ refresh: [] }>();
const documentLabels = {
  OUTBOUND: "源仓出库",
  SHIPMENT: "发运批次",
  TRANSPORT: "运输订单",
  INBOUND: "到仓入库"
};
const statuses: Record<string, string> = {
  CREATED: "已创建",
  READY: "备妥待交接",
  PARTIALLY_SHIPPED: "部分发运",
  SHIPPED: "已发运",
  PENDING: "待调度",
  DELIVERING: "分批交付中",
  COMPLETED: "已完成",
  RECEIVING: "收货中",
  READY_PUTAWAY: "待上架",
  PUTAWAY: "上架中"
};
const transfer = computed(() => props.order?.orderType === "TRANSFER");
const stepIndex: Record<string, number> = {
  DRAFT: 0,
  RELEASED: 1,
  FULFILLING: 2,
  COMPLETED: 3,
  CANCELLED: 1
};
const steps = computed(() => {
  const order = props.order;
  return {
    active: order ? (stepIndex[order.status] ?? 0) : 0,
    error: order?.status === "CANCELLED",
    items: ["草稿", "已释放", "履约中", "已完成"]
  };
});
</script>

<template>
  <el-drawer v-model="visible" title="订单详情" size="min(1100px, 95vw)">
    <template v-if="order">
      <el-steps
        :active="steps.active"
        :process-status="steps.error ? 'error' : 'process'"
        align-center
        class="order-steps"
      >
        <el-step v-for="title in steps.items" :key="title" :title="title" />
      </el-steps>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="订单号">{{
          order.orderNo
        }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{
          orderStatuses[order.status]
        }}</el-descriptions-item>
        <el-descriptions-item :label="transfer ? '源仓' : '供应商'">{{
          transfer ? order.sourceWarehouseName : order.supplierName
        }}</el-descriptions-item>
        <el-descriptions-item label="目标仓">{{
          order.targetWarehouseName
        }}</el-descriptions-item>
        <el-descriptions-item label="提货节点">{{
          order.pickupNodeName
        }}</el-descriptions-item>
        <el-descriptions-item label="收货节点">{{
          order.destinationNodeName
        }}</el-descriptions-item>
        <el-descriptions-item label="发货联系人"
          >{{ order.senderName }} {{ order.senderPhone }}</el-descriptions-item
        >
        <el-descriptions-item label="收货联系人"
          >{{ order.receiverName }}
          {{ order.receiverPhone }}</el-descriptions-item
        >
        <el-descriptions-item label="计划提货">{{
          formatDateTime(order.expectPickupTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="计划到货">{{
          formatDateTime(order.expectDeliveryTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="计划包裹数">{{
          order.plannedPackageCount
        }}</el-descriptions-item>
        <el-descriptions-item label="释放时间">{{
          formatDateTime(order.releasedTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{
          formatDateTime(order.completedTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{
          order.remark || "-"
        }}</el-descriptions-item>
        <el-descriptions-item v-if="order.cancelReason" label="取消原因">{{
          order.cancelReason
        }}</el-descriptions-item>
      </el-descriptions>
      <p class="progress-note">
        按来源单据累计履约；分批到仓分别收货、上架，全部需求完成上架后订单完成。
      </p>
      <el-table :data="order.items" row-key="orderItemId" border>
        <el-table-column prop="skuCode" label="SKU" min-width="140" />
        <el-table-column prop="goodsName" label="商品" min-width="140" />
        <el-table-column prop="unit" label="单位" width="65" />
        <el-table-column prop="quantity" label="需求" width="90" />
        <el-table-column
          v-if="transfer"
          prop="shippedQuantity"
          label="源仓已发"
          width="100"
        />
        <el-table-column
          prop="deliveredQuantity"
          label="到仓应收"
          width="100"
        />
        <el-table-column prop="receivedQuantity" label="已收货" width="90" />
        <el-table-column prop="putawayQuantity" label="已上架" width="90" />
      </el-table>
      <h3 class="documents-title">履约单据</h3>
      <el-empty
        v-if="!order.documents.length"
        :description="
          order.status === 'DRAFT' || order.status === 'CANCELLED'
            ? '订单尚未下发履约需求'
            : '执行单据生成中，可稍后刷新'
        "
        :image-size="60"
      />
      <el-table v-else :data="order.documents" border>
        <el-table-column label="类型" width="120"
          ><template #default="{ row }">{{
            documentLabels[row.documentType]
          }}</template></el-table-column
        >
        <el-table-column prop="documentNo" label="单据号" min-width="240" />
        <el-table-column label="状态" width="140"
          ><template #default="{ row }">{{
            statuses[row.status] || row.status
          }}</template></el-table-column
        >
        <el-table-column label="更新时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.updateTime)
          }}</template></el-table-column
        >
      </el-table>
    </template>
    <template #footer
      ><el-button @click="$emit('refresh')">刷新进度</el-button
      ><el-button @click="visible = false">关闭</el-button></template
    >
  </el-drawer>
</template>

<style scoped>
.order-steps {
  margin-bottom: 24px;
}

.progress-note {
  margin: 20px 0 12px;
  color: var(--el-text-color-secondary);
}

.documents-title {
  margin: 24px 0 12px;
}
</style>
