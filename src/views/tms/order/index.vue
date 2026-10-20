<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { hasPerms } from "@/utils/auth";
import { formatDateTime } from "@/utils/date";
import { orderApi, type TmsOrder, type OrderStatus } from "@/api/tmsOrder";
import { statusLabels } from "./presentation";
import OrderDialog from "./components/OrderDialog.vue";
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import GenerateTripDrawer from "./components/GenerateTripDrawer.vue";

defineOptions({ name: "TmsOrder" });
const filter = reactive({
  orderNo: "",
  senderName: "",
  receiverPhone: "",
  statuses: [] as OrderStatus[],
  pageNum: 1,
  pageSize: 10
});
const createRange = ref<[string, string]>();
const rows = ref<TmsOrder[]>([]);
const total = ref(0);
const loading = ref(false);
const dialogOpen = ref(false);
const readonly = ref(true);
const selected = ref<TmsOrder>();
const detailLoading = ref(false);
const actionId = ref<string>();
const tripOpen = ref(false);
const checkedOrders = ref<TmsOrder[]>([]);
const tripOrderIds = ref<string[]>([]);
function selectable(row: TmsOrder) {
  return row.status === "PENDING" || row.status === "EXECUTING";
}
function generateTrip() {
  tripOrderIds.value = checkedOrders.value.map(row => row.orderId);
  tripOpen.value = true;
}
async function tripSaved() {
  await load();
  if (selected.value && tripOrderIds.value.includes(selected.value.orderId))
    await show(selected.value, true);
}
let queryVersion = 0;
let detailVersion = 0;
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function load() {
  const version = ++queryVersion;
  loading.value = true;
  try {
    const page = await orderApi.page({
      ...filter,
      createTimeBegin: createRange.value
        ? Number(createRange.value[0])
        : undefined,
      createTimeEnd: createRange.value
        ? Number(createRange.value[1])
        : undefined
    });
    if (version !== queryVersion) return;
    checkedOrders.value = [];
    rows.value = page.records;
    total.value = page.total;
  } catch (reason) {
    if (version === queryVersion) error(reason);
  } finally {
    if (version === queryVersion) loading.value = false;
  }
}
function search() {
  filter.pageNum = 1;
  void load();
}
function reset() {
  Object.assign(filter, {
    orderNo: "",
    senderName: "",
    receiverPhone: "",
    statuses: []
  });
  createRange.value = undefined;
  search();
}
function create() {
  ++detailVersion;
  selected.value = undefined;
  readonly.value = false;
  dialogOpen.value = true;
}
async function show(row: TmsOrder, readOnly: boolean) {
  const version = ++detailVersion;
  detailLoading.value = true;
  try {
    const order = await orderApi.detail(row.orderId);
    if (version !== detailVersion) return;
    if (!readOnly && !order.editable)
      return ElMessage.warning("订单已实提或存在待执行任务，不能编辑");
    selected.value = order;
    readonly.value = readOnly;
    dialogOpen.value = true;
  } catch (reason) {
    if (version === detailVersion) error(reason);
  } finally {
    if (version === detailVersion) detailLoading.value = false;
  }
}
async function action(row: TmsOrder, kind: "cancel" | "close") {
  if (actionId.value) return;
  actionId.value = row.orderId;
  try {
    const { value } = await ElMessageBox.prompt(
      kind === "cancel"
        ? "取消前须撤销未执行任务；已实提订单不能取消。请填写取消原因。"
        : "系统将核验全部提货任务、运输和交付事实。有数量缺口时须填写供应商少备关闭原因。",
      (kind === "cancel" ? "取消订单 " : "订单完结 ") + row.orderNo,
      {
        inputPlaceholder:
          kind === "cancel"
            ? "取消原因（必填）"
            : "差异关闭原因；正常完成可留空",
        inputValidator: value =>
          kind === "close" || !!value?.trim() || "取消原因不能为空",
        inputType: "textarea"
      }
    );
    if (kind === "cancel") await orderApi.cancel(row.orderId, value.trim());
    else await orderApi.close(row.orderId, value?.trim() || undefined);
    ElMessage.success(kind === "cancel" ? "订单已取消" : "订单已完结");
    await load();
    if (selected.value?.orderId === row.orderId) await show(row, true);
  } catch (reason) {
    if (reason !== "cancel" && reason !== "close") error(reason);
  } finally {
    actionId.value = undefined;
  }
}
function active(row: TmsOrder) {
  return (
    row.status === "PENDING" ||
    row.status === "EXECUTING" ||
    row.status === "DELIVERED"
  );
}
onMounted(load);
</script>
<template>
  <div class="order-page tms-workspace">
    <WorkspaceHeader
      title="运输需求工作台"
      description="查看每一票运输需求、交付进度和容器流转。"
    />
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <div>
            <strong>运输需求管理</strong>
            <p class="hint">
              一个订单一个最终目的地，支持分批提货、多容器和多车次。
            </p>
          </div>
          <div>
            <el-button
              v-if="hasPerms('tms:order:split')"
              type="primary"
              :disabled="!checkedOrders.length || loading"
              @click="generateTrip"
              >生成车次{{
                checkedOrders.length ? `（${checkedOrders.length}）` : ""
              }}</el-button
            >
            <el-button
              v-if="hasPerms('tms:order:create')"
              type="primary"
              @click="create"
              >创建订单</el-button
            >
          </div>
        </div></template
      >
      <el-form inline @submit.prevent="search">
        <el-form-item label="订单号"
          ><el-input
            v-model="filter.orderNo"
            placeholder="完整订单号"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="发货人"
          ><el-input
            v-model="filter.senderName"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="收货电话"
          ><el-input
            v-model="filter.receiverPhone"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select
            v-model="filter.statuses"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            style="width: 240px"
            ><el-option
              v-for="(label, value) in statusLabels"
              :key="value"
              :label="label"
              :value="value" /></el-select
        ></el-form-item>
        <el-form-item label="创建时间"
          ><el-date-picker
            v-model="createRange"
            type="datetimerange"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
        /></el-form-item>
        <el-form-item
          ><el-button type="primary" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        >
      </el-form>
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="orderId"
        border
        @selection-change="checkedOrders = $event"
      >
        <el-table-column
          type="selection"
          width="50"
          fixed
          :selectable="selectable"
        />
        <el-table-column prop="orderNo" label="订单号" min-width="220" fixed />
        <el-table-column label="状态" width="110"
          ><template #default="{ row }"
            ><el-tag>{{
              statusLabels[row.status as OrderStatus]
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="senderName" label="发货人" min-width="120" />
        <el-table-column
          prop="destinationAddress"
          label="最终目的地地址"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="receiverName" label="收货人" width="120" />
        <el-table-column prop="receiverPhone" label="收货电话" width="150" />
        <el-table-column label="计划提货" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.expectPickupTime)
          }}</template></el-table-column
        >
        <el-table-column label="计划送达" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.expectDeliveryTime)
          }}</template></el-table-column
        >
        <el-table-column label="创建时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="230" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="detailLoading"
              @click="show(row as TmsOrder, true)"
              >查看</el-button
            >
            <el-button
              v-if="hasPerms('tms:order:edit')"
              link
              type="primary"
              :disabled="!active(row as TmsOrder) || detailLoading"
              @click="show(row as TmsOrder, false)"
              >编辑</el-button
            >
            <el-button
              v-if="hasPerms('tms:order:cancel')"
              link
              type="danger"
              :disabled="!active(row as TmsOrder) || !!actionId"
              @click="action(row as TmsOrder, 'cancel')"
              >取消</el-button
            >
            <el-button
              v-if="hasPerms('tms:order:close')"
              link
              type="primary"
              :disabled="!active(row as TmsOrder) || !!actionId"
              @click="action(row as TmsOrder, 'close')"
              >完结</el-button
            >
          </template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="filter.pageNum"
        v-model:page-size="filter.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        class="mt-4"
        @current-change="load"
        @size-change="search"
      />
    </el-card>
    <OrderDialog
      v-if="dialogOpen"
      v-model="dialogOpen"
      :order="selected"
      :readonly="readonly"
      @saved="load"
    />
    <GenerateTripDrawer
      v-model="tripOpen"
      :order-ids="tripOrderIds"
      @saved="tripSaved"
    />
  </div>
</template>
<style scoped>
.order-page {
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
