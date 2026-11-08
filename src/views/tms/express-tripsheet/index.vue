<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  tripSheetApi,
  tripStatuses,
  handoverStatuses,
  type TripSheet,
  type TripManifestWaybill,
  type HandoverSheet
} from "@/api/tmsExpress";
import { formatDateTime } from "@/utils/date";
import TripCreateDialog from "./TripCreateDialog.vue";

defineOptions({ name: "ExpressTripSheet" });

const query = reactive({
  tripNo: "",
  plateNumber: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<TripSheet[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const acting = shallowRef("");
const creating = shallowRef(false);
const detailVisible = shallowRef(false);
const detailLoading = shallowRef(false);
const detail = ref<TripSheet>();
const manifest = ref<TripManifestWaybill[]>([]);
const handovers = ref<HandoverSheet[]>([]);
const tripStatusTag: Record<number, "info" | "primary" | "success" | "danger"> =
  {
    10: "info",
    30: "primary",
    40: "success",
    99: "danger"
  };
let requestVersion = 0;

async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await tripSheetApi.page({ ...query });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(error instanceof Error ? error.message : "路单加载失败");
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function openDetail(row: TripSheet, reload = false) {
  detailVisible.value = true;
  if (!reload) detailLoading.value = true;
  try {
    detail.value = await tripSheetApi.detail(row.tripId);
    manifest.value = await tripSheetApi.manifest(row.tripId);
    handovers.value = await tripSheetApi.handovers(row.tripId);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  } finally {
    detailLoading.value = false;
  }
}
async function depart(row: TripSheet) {
  try {
    await ElMessageBox.confirm(`路单「${row.tripNo}」确认发车？`, "路单发车", {
      type: "warning"
    });
    acting.value = row.tripId;
    await tripSheetApi.depart(row.tripId);
    ElMessage.success("路单已发车");
    await load();
    if (detailVisible.value && detail.value?.tripId === row.tripId)
      await openDetail(row, true);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
async function arriveStop(row: TripSheet, stopSeq: number) {
  try {
    await ElMessageBox.confirm(
      `路单「${row.tripNo}」确认到达第 ${stopSeq} 站？`,
      "到站确认",
      { type: "warning" }
    );
    acting.value = row.tripId;
    await tripSheetApi.arriveStop(row.tripId, stopSeq);
    ElMessage.success("到站已确认");
    await openDetail(row, true);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
async function finish(row: TripSheet) {
  try {
    await ElMessageBox.confirm(`路单「${row.tripNo}」确认完成？`, "路单完成", {
      type: "warning"
    });
    acting.value = row.tripId;
    await tripSheetApi.finish(row.tripId);
    ElMessage.success("路单已完成");
    await load();
    if (detailVisible.value && detail.value?.tripId === row.tripId)
      await openDetail(row, true);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
function reset() {
  query.tripNo = "";
  query.plateNumber = "";
  query.status = undefined;
  void load(true);
}
load(true);
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>路单</span
          ><el-button type="primary" @click="creating = true"
            >创建路单</el-button
          >
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="路单号"
          ><el-input v-model="query.tripNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="车牌号"
          ><el-input v-model="query.plateNumber" clearable maxlength="32"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 130px"
            ><el-option
              v-for="(label, value) in tripStatuses"
              :key="value"
              :value="Number(value)"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="tripId">
        <el-table-column label="路单号" min-width="180"
          ><template #default="{ row }"
            ><span class="sheet-no">{{ (row as TripSheet).tripNo }}</span
            ><br /><el-tag
              :type="tripStatusTag[(row as TripSheet).status]"
              size="small"
              >{{
                tripStatuses[(row as TripSheet).status] ??
                (row as TripSheet).status
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="车辆/司机" min-width="150"
          ><template #default="{ row }"
            >{{ (row as TripSheet).plateNumber || "-" }}<br />{{
              (row as TripSheet).driverName || "-"
            }}</template
          ></el-table-column
        >
        <el-table-column label="起点" min-width="140"
          ><template #default="{ row }">{{
            (row as TripSheet).departNodeName || "-"
          }}</template></el-table-column
        >
        <el-table-column label="计划发车" width="170"
          ><template #default="{ row }">{{
            formatDateTime((row as TripSheet).planDepartTime)
          }}</template></el-table-column
        >
        <el-table-column label="实际发车" width="170"
          ><template #default="{ row }">{{
            formatDateTime((row as TripSheet).actualDepartTime)
          }}</template></el-table-column
        >
        <el-table-column label="完成时间" width="170"
          ><template #default="{ row }">{{
            formatDateTime((row as TripSheet).completeTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="170" fixed="right"
          ><template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row as TripSheet)"
              >详情</el-button
            >
            <el-button
              v-if="(row as TripSheet).status === 10"
              link
              type="primary"
              :disabled="Boolean(acting)"
              @click="depart(row as TripSheet)"
              >发车</el-button
            >
            <el-button
              v-if="(row as TripSheet).status === 30"
              link
              type="primary"
              :disabled="Boolean(acting)"
              @click="finish(row as TripSheet)"
              >完成</el-button
            >
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
    <TripCreateDialog v-model="creating" @saved="load(true)" />
    <el-drawer v-model="detailVisible" title="路单详情" size="min(860px, 95vw)">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="路单号">{{
              detail.tripNo
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{
              tripStatuses[detail.status] ?? detail.status
            }}</el-descriptions-item>
            <el-descriptions-item label="车辆">{{
              detail.plateNumber || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="司机">{{
              detail.driverName || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="起点节点">{{
              detail.departNodeName || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="运输方式">{{
              detail.transportMode || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="计划发车">{{
              formatDateTime(detail.planDepartTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="实际发车">{{
              formatDateTime(detail.actualDepartTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{
              formatDateTime(detail.completeTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{
              detail.remark || "-"
            }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="block-title">路线站点</h3>
          <el-table :data="detail.stops ?? []" border size="small">
            <el-table-column label="站序" width="70"
              ><template #default="{ row }">{{
                row.stopSeq
              }}</template></el-table-column
            >
            <el-table-column label="转运中心" min-width="140"
              ><template #default="{ row }">{{
                row.nodeName
              }}</template></el-table-column
            >
            <el-table-column label="计划到达" width="165"
              ><template #default="{ row }">{{
                formatDateTime(row.planArriveTime)
              }}</template></el-table-column
            >
            <el-table-column label="实际到达" width="165"
              ><template #default="{ row }">{{
                formatDateTime(row.actualArriveTime)
              }}</template></el-table-column
            >
            <el-table-column label="操作" width="110"
              ><template #default="{ row }">
                <el-button
                  v-if="detail && detail.status === 30 && !row.actualArriveTime"
                  link
                  type="primary"
                  :disabled="Boolean(acting)"
                  @click="arriveStop(detail, row.stopSeq)"
                  >到站</el-button
                >
              </template></el-table-column
            >
          </el-table>
          <h3 class="block-title">配载运单</h3>
          <el-empty
            v-if="!manifest.length"
            description="暂无配载运单"
            :image-size="60"
          />
          <el-table v-else :data="manifest" border size="small">
            <el-table-column prop="waybillNo" label="运单号" min-width="180" />
            <el-table-column label="状态" width="120"
              ><template #default="{ row }">{{
                row.status ?? "-"
              }}</template></el-table-column
            >
          </el-table>
          <h3 class="block-title">关联交接单</h3>
          <el-empty
            v-if="!handovers.length"
            description="暂无交接单"
            :image-size="60"
          />
          <el-table v-else :data="handovers" border size="small">
            <el-table-column
              prop="handoverNo"
              label="交接单号"
              min-width="180"
            />
            <el-table-column label="状态" width="110"
              ><template #default="{ row }">{{
                handoverStatuses[row.status] ?? row.status
              }}</template></el-table-column
            >
            <el-table-column label="交方 → 接方" min-width="180"
              ><template #default="{ row }"
                >{{ row.fromNodeName }} → {{ row.toNodeName }}</template
              ></el-table-column
            >
          </el-table>
          <div class="detail-actions">
            <el-button @click="openDetail(detail, true)">刷新</el-button>
            <el-button
              v-if="detail.status === 10"
              type="primary"
              :disabled="Boolean(acting)"
              @click="depart(detail)"
              >发车</el-button
            >
            <el-button
              v-if="detail.status === 30"
              type="primary"
              :disabled="Boolean(acting)"
              @click="finish(detail)"
              >完成</el-button
            >
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-no {
  font-weight: 600;
}

.block-title {
  margin: 20px 0 12px;
}

.detail-actions {
  margin-top: 16px;
}
</style>
