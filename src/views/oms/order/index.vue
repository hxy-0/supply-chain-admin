<script setup lang="ts">
import { computed, ref, reactive, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  omsApi,
  orderStatuses,
  type OmsOrder,
  type OrderStatus
} from "@/api/oms";
import { warehouseApi, type Warehouse } from "@/api/wms";
import { formatDateTime } from "@/utils/date";
import OrderEditDrawer from "./OrderEditDrawer.vue";
import OrderDetailDrawer from "./OrderDetailDrawer.vue";

const route = useRoute();
const orderType = computed(() =>
  route.path === "/oms/transfers" ? "TRANSFER" : "PURCHASE"
);
const title = computed(() =>
  orderType.value === "PURCHASE" ? "采购订单" : "调拨单"
);
const query = reactive({
  orderNo: "",
  status: undefined as OrderStatus | undefined,
  targetWarehouseId: undefined as string | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<OmsOrder[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const acting = shallowRef("");
const editing = shallowRef(false);
const showing = shallowRef(false);
const selected = ref<OmsOrder>();
const warehouses = ref<Warehouse[]>([]);
const statCards = ref<{ status: OrderStatus; label: string; count: number }[]>(
  []
);
const statStatuses: OrderStatus[] = [
  "DRAFT",
  "FULFILLING",
  "COMPLETED",
  "CANCELLED"
];
let requestVersion = 0;
async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await omsApi.page({ ...query, orderType: orderType.value });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(error instanceof Error ? error.message : "订单加载失败");
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function loadStats() {
  const counts = await Promise.all(
    statStatuses.map(async status => {
      try {
        const page = await omsApi.page({
          orderType: orderType.value,
          status,
          pageNum: 1,
          pageSize: 1
        });
        return {
          status,
          label: orderStatuses[status],
          count: Number(page.total)
        };
      } catch {
        return { status, label: orderStatuses[status], count: 0 };
      }
    })
  );
  statCards.value = counts;
}
async function loadWarehouses() {
  try {
    warehouses.value = (
      await warehouseApi.page({ status: 0, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
}
function pickStatus(status: OrderStatus | undefined) {
  query.status = query.status === status ? undefined : status;
  void load(true);
}
function reset() {
  query.orderNo = "";
  query.status = undefined;
  query.targetWarehouseId = undefined;
  void load(true);
}
async function open(order: OmsOrder, edit = false) {
  try {
    selected.value = await omsApi.detail(order.orderId);
    if (edit) editing.value = true;
    else showing.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  }
}
function create() {
  selected.value = undefined;
  editing.value = true;
}
async function release(order: OmsOrder) {
  try {
    await ElMessageBox.confirm(
      orderType.value === "PURCHASE"
        ? "释放后将安排提货运输，需求不可再修改。"
        : "释放后将向源仓下发出库需求，需求不可再修改。",
      "释放订单",
      { type: "warning" }
    );
    acting.value = order.orderId;
    await omsApi.release(order);
    ElMessage.success("订单已释放，执行单据由后台生成");
    await Promise.all([load(), loadStats()]);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
async function cancel(order: OmsOrder) {
  try {
    const result = await ElMessageBox.prompt("请输入取消原因", "取消草稿", {
      inputValidator: value => Boolean(value?.trim()) || "请填写取消原因",
      inputType: "textarea"
    });
    acting.value = order.orderId;
    await omsApi.cancel(order, result.value.trim());
    await Promise.all([load(), loadStats()]);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
function originName(order: OmsOrder) {
  return orderType.value === "PURCHASE"
    ? order.supplierName
    : order.sourceWarehouseName;
}
function progress(order: OmsOrder) {
  let quantity = 0;
  let shipped = 0;
  let received = 0;
  let putaway = 0;
  for (const item of order.items) {
    quantity += item.quantity;
    shipped += item.shippedQuantity;
    received += item.receivedQuantity;
    putaway += item.putawayQuantity;
  }
  const lines = [];
  if (orderType.value === "TRANSFER") lines.push(`发运 ${shipped}/${quantity}`);
  lines.push(`实收 ${received}/${quantity}`);
  lines.push(`上架 ${putaway}/${quantity}`);
  return lines;
}
const statusTagTypes: Record<
  OrderStatus,
  "primary" | "success" | "warning" | "info" | "danger"
> = {
  DRAFT: "info",
  RELEASED: "primary",
  FULFILLING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger"
};
watch(
  orderType,
  () => {
    editing.value = false;
    showing.value = false;
    selected.value = undefined;
    query.orderNo = "";
    query.status = undefined;
    query.targetWarehouseId = undefined;
    void load(true);
    void loadStats();
    void loadWarehouses();
  },
  { immediate: true }
);
</script>

<template>
  <div class="main">
    <div class="stats">
      <div
        v-for="card in statCards"
        :key="card.status"
        class="stat-card"
        :class="{ active: query.status === card.status }"
        @click="pickStatus(card.status)"
      >
        <p class="stat-label">{{ card.label }}</p>
        <p class="stat-count">{{ card.count }}</p>
      </div>
    </div>
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>{{ title }}</span
          ><el-button type="primary" @click="create">新建{{ title }}</el-button>
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="单号"
          ><el-input v-model="query.orderNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 140px"
            ><el-option
              v-for="(label, value) in orderStatuses"
              :key="value"
              :value="value"
              :label="label" /></el-select
        ></el-form-item>
        <el-form-item label="目标仓"
          ><el-select
            v-model="query.targetWarehouseId"
            clearable
            filterable
            style="width: 180px"
            ><el-option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="String(warehouse.id)"
              :label="warehouse.name" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="orderId">
        <el-table-column label="订单号" min-width="180"
          ><template #default="{ row }"
            ><span class="order-no">{{ row.orderNo }}</span
            ><br /><el-tag
              :type="statusTagTypes[row.status as OrderStatus]"
              size="small"
              >{{ orderStatuses[row.status as OrderStatus] }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="起讫" min-width="240"
          ><template #default="{ row }">
            <p class="route-line">{{ originName(row as OmsOrder) }}</p>
            <p class="route-line">
              → {{ (row as OmsOrder).targetWarehouseName }}
            </p>
            <p class="route-contact">
              发 {{ (row as OmsOrder).senderName }} · 收
              {{ (row as OmsOrder).receiverName }}
            </p>
          </template></el-table-column
        >
        <el-table-column
          v-if="orderType === 'PURCHASE'"
          label="提货节点"
          min-width="130"
          ><template #default="{ row }">{{
            (row as OmsOrder).pickupNodeName
          }}</template></el-table-column
        >
        <el-table-column label="履约进度" min-width="150"
          ><template #default="{ row }">
            <p
              v-for="line in progress(row as OmsOrder)"
              :key="line"
              class="progress-line"
            >
              {{ line }}
            </p>
          </template></el-table-column
        >
        <el-table-column label="计划时间" min-width="180"
          ><template #default="{ row }">
            <p class="progress-line">
              提货 {{ formatDateTime((row as OmsOrder).expectPickupTime) }}
            </p>
            <p class="progress-line">
              到货 {{ formatDateTime((row as OmsOrder).expectDeliveryTime) }}
            </p>
          </template></el-table-column
        >
        <el-table-column label="创建时间" width="170"
          ><template #default="{ row }">{{
            formatDateTime((row as OmsOrder).createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="220" fixed="right"
          ><template #default="{ row }">
            <el-button link type="primary" @click="open(row as OmsOrder)"
              >详情</el-button
            >
            <template v-if="row.status === 'DRAFT'">
              <el-button
                link
                type="primary"
                @click="open(row as OmsOrder, true)"
                >编辑</el-button
              >
              <el-button
                link
                type="primary"
                :disabled="Boolean(acting)"
                @click="release(row as OmsOrder)"
                >释放</el-button
              >
              <el-button
                link
                type="danger"
                :disabled="Boolean(acting)"
                @click="cancel(row as OmsOrder)"
                >取消</el-button
              >
            </template>
          </template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum"
        :page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load()"
      />
    </el-card>
    <OrderEditDrawer
      v-model="editing"
      :order-type="orderType"
      :order="selected"
      @saved="
        () => {
          load(true);
          loadStats();
        }
      "
    />
    <OrderDetailDrawer
      v-model="showing"
      :order="selected"
      @refresh="selected && open(selected)"
    />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  padding: 16px 20px;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  transition: border-color 0.2s;
}

.stat-card.active {
  border-color: var(--el-color-primary);
}

.stat-label {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-count {
  margin: 6px 0 0;
  font-size: 24px;
  font-weight: 600;
}

.order-no {
  font-weight: 600;
}

.route-line {
  margin: 0;
  line-height: 1.6;
}

.route-contact {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.progress-line {
  margin: 0;
  line-height: 1.6;
}
</style>
