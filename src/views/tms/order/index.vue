<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { formatDateTime } from "@/utils/date";
import { statusLabels, formatWeight, formatVolume } from "./presentation";
import { orderApi, type ExpressOrder } from "@/api/tmsOrder";
import OrderDialog from "./components/OrderDialog.vue";
const readonly = ref(true);
const editOpen = ref(false);
const editOrder = ref<ExpressOrder>();
defineOptions({ name: "TmsOrder" });
const filter = reactive({
  orderNo: "",
  waybillNo: "",
  senderPhone: "",
  receiverPhone: "",
  tempZone: undefined as number | undefined,
  senderName: "",
  receiverName: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 10
});
const createRange = ref<[number, number]>();
let queryVersion = 0;
let detailVersion = 0;
const detailLoading = ref(false);
const rows = ref<ExpressOrder[]>([]);
const total = ref(0);
const loading = ref(false);
const tempLabels: Record<number, string> = {
  1: "常温",
  2: "冷藏",
  3: "水产",
  4: "工业品"
};
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "查询失败");
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
  filter.orderNo = "";
  filter.waybillNo = "";
  filter.senderName = "";
  filter.receiverName = "";
  filter.senderPhone = "";
  filter.receiverPhone = "";
  filter.status = undefined;
  filter.tempZone = undefined;
  createRange.value = undefined;
  search();
}
async function show(row: ExpressOrder, readOnly: boolean) {
  const version = ++detailVersion;
  detailLoading.value = true;
  try {
    const result = await orderApi.detail(row.orderId);
    if (version !== detailVersion) return;
    editOrder.value = result;
    readonly.value = readOnly;
    editOpen.value = true;
  } catch (reason) {
    error(reason);
  } finally {
    if (version === detailVersion) detailLoading.value = false;
  }
}
async function cancel(row: ExpressOrder) {
  try {
    const { value } = await ElMessageBox.prompt(
      "请输入取消原因",
      `取消订单 ${row.orderNo}`,
      {
        inputValidator: value => !!value?.trim() || "请填写取消原因",
        inputPlaceholder: "取消原因",
        confirmButtonText: "确认取消"
      }
    );
    await orderApi.cancel(row.orderId, value.trim());
    ElMessage.success("订单已取消");
    await load();
  } catch (reason) {
    if (reason !== "cancel" && reason !== "close") error(reason);
  }
}
onMounted(load);
</script>
<template>
  <div class="order-page">
    <el-card shadow="never">
      <template #header
        ><strong>订单管理</strong>
        <div class="hint">
          查询、编辑及取消订单；现场提货和装车在小程序办理。
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
        <el-form-item label="发货联系人"
          ><el-input v-model="filter.senderName" clearable
        /></el-form-item>
        <el-form-item label="收货联系人"
          ><el-input v-model="filter.receiverName" clearable
        /></el-form-item>
        <el-form-item label="运单号"
          ><el-input
            v-model="filter.waybillNo"
            placeholder="关联运单号"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="发货电话"
          ><el-input
            v-model="filter.senderPhone"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="收货电话"
          ><el-input
            v-model="filter.receiverPhone"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="温区"
          ><el-select
            v-model="filter.tempZone"
            clearable
            placeholder="全部温区"
            style="width: 140px"
            ><el-option
              v-for="(label, value) in tempLabels"
              :key="value"
              :label="label"
              :value="Number(value)" /></el-select
        ></el-form-item>
        <el-form-item label="下单时间"
          ><el-date-picker
            v-model="createRange"
            type="datetimerange"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select
            v-model="filter.status"
            clearable
            placeholder="全部状态"
            style="width: 140px"
            ><el-option
              v-for="(label, value) in statusLabels"
              :key="value"
              :label="label"
              :value="Number(value)" /></el-select
        ></el-form-item>
        <el-form-item
          ><el-button type="primary" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        >
      </el-form>
      <el-table
        v-loading="loading || detailLoading"
        :data="rows"
        row-key="orderId"
        empty-text="暂无符合条件的订单"
      >
        <el-table-column prop="orderNo" label="订单号" min-width="200" />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.status === 99
                  ? 'info'
                  : row.status === 30
                    ? 'success'
                    : 'primary'
              "
              >{{ statusLabels[row.status] }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="温区" width="90"
          ><template #default="{ row }">{{
            tempLabels[row.tempZone]
          }}</template></el-table-column
        >
        <el-table-column label="下单时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="商品数量" width="110"
          ><template #default="{ row }">{{
            row.goodsQuantity ?? "—"
          }}</template></el-table-column
        >
        <el-table-column
          prop="sender.name"
          label="发货联系人"
          min-width="100"
        />
        <el-table-column
          prop="senderAddress.formattedAddress"
          label="提货地址"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="receiver.name"
          label="收货联系人"
          min-width="100"
        />
        <el-table-column
          prop="receiverAddress.formattedAddress"
          label="送货地址"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column label="预计重量(kg)" width="140"
          ><template #default="{ row }">{{
            formatWeight(row.weightKg)
          }}</template></el-table-column
        >
        <el-table-column label="预计体积(m³)" width="120"
          ><template #default="{ row }">{{
            formatVolume(row.volumeCm3)
          }}</template></el-table-column
        >
        <el-table-column label="计划提货时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.expectPickupTime)
          }}</template></el-table-column
        >
        <el-table-column label="计划送达时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.expectDeliveryTime)
          }}</template></el-table-column
        >
        <el-table-column label="实际提货时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.actualPickupTime)
          }}</template></el-table-column
        >
        <el-table-column label="提货完成时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.actualCompletionTime)
          }}</template></el-table-column
        >

        <el-table-column label="操作" fixed="right" width="180"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              @click="show(row as ExpressOrder, true)"
              >查看</el-button
            ><el-button
              link
              type="primary"
              :disabled="row.status !== 10"
              @click="show(row as ExpressOrder, false)"
              >编辑</el-button
            ><el-button
              link
              type="danger"
              :disabled="row.status !== 10"
              @click="cancel(row as ExpressOrder)"
              >取消</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="filter.pageNum"
        v-model:page-size="filter.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 20px"
        @current-change="load"
        @size-change="search"
      />
    </el-card>
    <OrderDialog
      v-if="editOrder"
      v-model="editOpen"
      :order="editOrder"
      :readonly="readonly"
      @saved="load"
    />
  </div>
</template>
<style scoped>
.order-page {
  padding: 16px;
}

.hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
