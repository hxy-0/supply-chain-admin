<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { formatDateTime } from "@/utils/date";
import {
  statusLabels,
  statusTagTypes,
  formatWeight,
  formatVolume
} from "./presentation";
import { waybillApi, type Waybill, type WaybillDetail } from "@/api/tmsWaybill";
import WaybillDrawer from "./WaybillDrawer.vue";

defineOptions({ name: "TmsWaybill" });
const filter = reactive({
  waybillNo: "",
  orderNo: "",
  senderName: "",
  receiverName: "",
  receiverPhone: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 10
});
const createRange = ref<[number, number]>();
let queryVersion = 0;
let detailVersion = 0;
const detailLoading = ref(false);
const rows = ref<Waybill[]>([]);
const total = ref(0);
const loading = ref(false);
const detail = ref<WaybillDetail>();
const drawerOpen = ref(false);

function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "查询失败");
}
async function load() {
  const version = ++queryVersion;
  loading.value = true;
  try {
    const page = await waybillApi.page({
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
  filter.waybillNo = "";
  filter.orderNo = "";
  filter.senderName = "";
  filter.receiverName = "";
  filter.receiverPhone = "";
  filter.status = undefined;
  createRange.value = undefined;
  search();
}
async function show(row: Waybill) {
  const version = ++detailVersion;
  detailLoading.value = true;
  try {
    const result = await waybillApi.detail(row.waybillId);
    if (version !== detailVersion) return;
    detail.value = result;
    drawerOpen.value = true;
  } catch (reason) {
    error(reason);
  } finally {
    if (version === detailVersion) detailLoading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="waybill-page">
    <el-card shadow="never">
      <template #header
        ><strong>运单管理</strong>
        <div class="hint">
          运单由现场提货生成；整车直发或零担拼车由司机装车时确认，调度在小程序办理。
        </div></template
      >
      <el-form inline @submit.prevent="search">
        <el-form-item label="运单号"
          ><el-input
            v-model="filter.waybillNo"
            placeholder="完整运单号"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="订单号"
          ><el-input
            v-model="filter.orderNo"
            placeholder="完整订单号"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="发货人"
          ><el-input v-model="filter.senderName" clearable
        /></el-form-item>
        <el-form-item label="收货人"
          ><el-input v-model="filter.receiverName" clearable
        /></el-form-item>
        <el-form-item label="收货电话"
          ><el-input
            v-model="filter.receiverPhone"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select
            v-model="filter.status"
            clearable
            placeholder="全部状态"
            style="width: 160px"
            ><el-option
              v-for="(label, value) in statusLabels"
              :key="value"
              :label="label"
              :value="Number(value)" /></el-select
        ></el-form-item>
        <el-form-item label="创建时间"
          ><el-date-picker
            v-model="createRange"
            type="datetimerange"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
        /></el-form-item>
        <el-form-item
          ><el-button type="primary" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        >
      </el-form>
      <el-table
        v-loading="loading || detailLoading"
        :data="rows"
        row-key="waybillId"
        empty-text="暂无符合条件的运单"
      >
        <el-table-column prop="waybillNo" label="运单号" min-width="190" />
        <el-table-column prop="orderNo" label="订单号" min-width="190"
          ><template #default="{ row }">{{
            row.orderNo || "—"
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="130"
          ><template #default="{ row }"
            ><el-tag :type="statusTagTypes[row.status] as any">{{
              statusLabels[row.status]
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          prop="goodsSummary"
          label="商品"
          min-width="180"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            row.goodsSummary || row.goodsName || "—"
          }}</template></el-table-column
        >
        <el-table-column label="件数" width="80"
          ><template #default="{ row }">{{
            row.pieceCount ?? "—"
          }}</template></el-table-column
        >
        <el-table-column label="重量(kg)" width="110"
          ><template #default="{ row }">{{
            formatWeight(row.weightKg)
          }}</template></el-table-column
        >
        <el-table-column label="体积(m³)" width="110"
          ><template #default="{ row }">{{
            formatVolume(row.volumeCm3)
          }}</template></el-table-column
        >
        <el-table-column
          prop="senderName"
          label="发货人"
          min-width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="receiverName"
          label="收货人"
          min-width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="receiverAddress"
          label="收货地址"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column label="创建时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="签收时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.signedTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="90"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="show(row as Waybill)"
              >查看</el-button
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
    <WaybillDrawer v-if="detail" v-model="drawerOpen" :detail="detail" />
  </div>
</template>
<style scoped>
.waybill-page {
  padding: 16px;
}

.hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
