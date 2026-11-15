<script setup lang="ts">
import { computed } from "vue";
import {
  orderStatuses,
  type OmsOrder,
  type PurchaseFulfillment,
  type PurchaseExecution
} from "@/api/oms";
import { formatDateTime } from "@/utils/date";
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ order?: OmsOrder }>();
defineEmits<{
  refresh: [];
  createExecution: [fulfillment: PurchaseFulfillment];
  startExecution: [execution: PurchaseExecution];
  cancelExecution: [execution: PurchaseExecution];
}>();
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
  EXECUTING: "执行中",
  DELIVERING: "分批交付中",
  DELIVERED: "已到仓",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  RECEIVING: "收货中",
  READY_PUTAWAY: "待上架",
  PUTAWAY: "上架中"
};
const purchaseFulfillmentStatuses: Record<string, string> = {
  PENDING: "待执行",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const purchaseExecutionStatuses: Record<string, string> = {
  CREATED: "待开始",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
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
        按来源单据累计履约；分批到仓分别收货、上架，全部需求完成上架或取消后订单完成。
      </p>
      <el-table :data="order.items" row-key="orderItemId" border>
        <el-table-column prop="skuCode" label="SKU" min-width="140" />
        <el-table-column prop="goodsName" label="商品" min-width="140" />
        <el-table-column prop="unit" label="单位" width="65" />
        <el-table-column prop="quantity" label="需求" width="90" />
        <el-table-column
          v-if="!transfer"
          prop="cancelledQuantity"
          label="已取消"
          width="90"
        />
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
      <template v-if="order.orderType === 'PURCHASE'">
        <h3 class="documents-title">采购履约链路</h3>
        <el-empty
          v-if="!order.purchaseFulfillments.length"
          description="释放采购需求后生成履约安排"
          :image-size="60"
        />
        <el-card
          v-for="fulfillment in order.purchaseFulfillments"
          :key="fulfillment.fulfillmentId"
          shadow="never"
          class="purchase-fulfillment"
        >
          <template #header>
            <div class="purchase-header">
              <span>
                履约单 {{ fulfillment.fulfillmentNo }} ·
                {{ purchaseFulfillmentStatuses[fulfillment.status] }}
              </span>
              <el-button
                v-if="fulfillment.status === 'PENDING'"
                type="primary"
                size="small"
                @click="$emit('createExecution', fulfillment)"
                >生成执行单</el-button
              >
            </div>
          </template>
          <p class="progress-note">
            {{ fulfillment.pickupNodeName }} →
            {{ fulfillment.destinationNodeName }} · 提货
            {{ formatDateTime(fulfillment.expectPickupTime) }} · 到货
            {{ formatDateTime(fulfillment.expectDeliveryTime) }}
          </p>
          <el-table
            :data="fulfillment.items"
            row-key="fulfillmentItemId"
            border
          >
            <el-table-column prop="skuCode" label="SKU" min-width="130" />
            <el-table-column prop="goodsName" label="商品" min-width="130" />
            <el-table-column prop="unit" label="单位" width="70" />
            <el-table-column prop="quantity" label="计划数量" width="100" />
          </el-table>
          <el-table
            v-if="fulfillment.executions.length"
            :data="fulfillment.executions"
            row-key="executionId"
            border
            class="purchase-executions"
          >
            <el-table-column
              prop="executionNo"
              label="执行单号"
              min-width="180"
            />
            <el-table-column label="执行状态" width="110">
              <template #default="{ row }">
                {{ purchaseExecutionStatuses[row.status] || row.status }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'CREATED'"
                  link
                  type="primary"
                  @click="$emit('startExecution', row as PurchaseExecution)"
                  >开始执行</el-button
                >
                <el-button
                  v-if="row.status === 'CREATED'"
                  link
                  type="danger"
                  @click="$emit('cancelExecution', row as PurchaseExecution)"
                  >取消</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
      <h3 class="documents-title">履约单据</h3>
      <el-empty
        v-if="!order.documents.length"
        :description="
          order.status === 'DRAFT' || order.status === 'CANCELLED'
            ? '订单尚未下发履约需求'
            : order.orderType === 'PURCHASE' &&
                order.purchaseFulfillments.every(fulfillment =>
                  fulfillment.executions.every(
                    execution =>
                      execution.status !== 'EXECUTING' &&
                      execution.status !== 'COMPLETED'
                  )
                )
              ? '采购执行单开始后才会向下游下发'
              : '下游单据生成中，可稍后刷新'
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

.purchase-fulfillment {
  margin-bottom: 12px;
}

.purchase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.purchase-executions {
  margin-top: 16px;
}
</style>
