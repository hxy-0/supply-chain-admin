<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  handoverApi,
  handoverStatuses,
  handoverTypes,
  type HandoverSheet
} from "@/api/tmsExpress";
import { formatDateTime } from "@/utils/date";
import HandoverCreateDialog from "./HandoverCreateDialog.vue";

defineOptions({ name: "ExpressHandover" });

const query = reactive({
  handoverNo: "",
  status: undefined as number | undefined,
  handoverType: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<HandoverSheet[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const acting = shallowRef("");
const creating = shallowRef(false);
const detailVisible = shallowRef(false);
const detailLoading = shallowRef(false);
const detail = ref<HandoverSheet>();
const handoverStatusTag: Record<
  number,
  "info" | "primary" | "warning" | "success" | "danger"
> = {
  10: "info",
  20: "primary",
  30: "warning",
  40: "success",
  99: "danger"
};
let requestVersion = 0;

async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await handoverApi.page({ ...query });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(
        error instanceof Error ? error.message : "交接单加载失败"
      );
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function openDetail(row: HandoverSheet, reload = false) {
  detailVisible.value = true;
  if (!reload) detailLoading.value = true;
  try {
    detail.value = await handoverApi.detail(row.handoverId);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  } finally {
    detailLoading.value = false;
  }
}
async function advance(
  row: HandoverSheet,
  action: "depart" | "arrive" | "receive"
) {
  const labels = { depart: "发车", arrive: "到达登记", receive: "接收确认" };
  try {
    await ElMessageBox.confirm(
      `对交接单「${row.handoverNo}」执行${labels[action]}？`,
      labels[action],
      { type: "warning" }
    );
    acting.value = row.handoverId;
    if (action === "depart") await handoverApi.depart(row.handoverId);
    else if (action === "arrive") await handoverApi.arrive(row.handoverId);
    else await handoverApi.receive(row.handoverId, []);
    ElMessage.success(`${labels[action]}完成`);
    await load();
    if (detailVisible.value && detail.value?.handoverId === row.handoverId)
      await openDetail(row, true);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
function reset() {
  query.handoverNo = "";
  query.status = undefined;
  query.handoverType = undefined;
  void load(true);
}
load(true);
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>交接单</span
          ><el-button type="primary" @click="creating = true"
            >新建交接单</el-button
          >
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="交接单号"
          ><el-input v-model="query.handoverNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 130px"
            ><el-option
              v-for="(label, value) in handoverStatuses"
              :key="value"
              :value="Number(value)"
              :label="label" /></el-select
        ></el-form-item>
        <el-form-item label="类型"
          ><el-select
            v-model="query.handoverType"
            clearable
            style="width: 130px"
            ><el-option
              v-for="(label, value) in handoverTypes"
              :key="value"
              :value="Number(value)"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="handoverId">
        <el-table-column label="交接单号" min-width="180"
          ><template #default="{ row }"
            ><span class="sheet-no">{{
              (row as HandoverSheet).handoverNo
            }}</span
            ><br /><el-tag
              :type="handoverStatusTag[(row as HandoverSheet).status]"
              size="small"
              >{{
                handoverStatuses[(row as HandoverSheet).status] ??
                (row as HandoverSheet).status
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="类型" width="100"
          ><template #default="{ row }">{{
            handoverTypes[(row as HandoverSheet).handoverType] ?? "-"
          }}</template></el-table-column
        >
        <el-table-column label="交接节点" min-width="200"
          ><template #default="{ row }"
            >{{ (row as HandoverSheet).fromNodeName }} →
            {{ (row as HandoverSheet).toNodeName }}</template
          ></el-table-column
        >
        <el-table-column label="件数/重量" width="130"
          ><template #default="{ row }"
            >{{ (row as HandoverSheet).pieceCount ?? "-" }} 件 /
            {{ (row as HandoverSheet).totalWeightKg ?? "-" }} kg</template
          ></el-table-column
        >
        <el-table-column label="发车/到达" min-width="200"
          ><template #default="{ row }">
            <p class="time-line">
              发 {{ formatDateTime((row as HandoverSheet).departTime) }}
            </p>
            <p class="time-line">
              到 {{ formatDateTime((row as HandoverSheet).arriveTime) }}
            </p>
          </template></el-table-column
        >
        <el-table-column label="接收" width="170"
          ><template #default="{ row }">
            <p class="time-line">
              {{ formatDateTime((row as HandoverSheet).receiveTime) }}
            </p>
            <p class="time-line">
              {{ (row as HandoverSheet).receiveOperator || "" }}
            </p>
          </template></el-table-column
        >
        <el-table-column label="操作" width="200" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="openDetail(row as HandoverSheet)"
              >详情</el-button
            >
            <el-button
              v-if="(row as HandoverSheet).status === 10"
              link
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(row as HandoverSheet, 'depart')"
              >发车</el-button
            >
            <el-button
              v-if="(row as HandoverSheet).status === 20"
              link
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(row as HandoverSheet, 'arrive')"
              >到达</el-button
            >
            <el-button
              v-if="(row as HandoverSheet).status === 30"
              link
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(row as HandoverSheet, 'receive')"
              >接收</el-button
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
    <HandoverCreateDialog v-model="creating" @saved="load(true)" />
    <el-drawer
      v-model="detailVisible"
      title="交接单详情"
      size="min(720px, 95vw)"
    >
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="交接单号">{{
              detail.handoverNo
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{
              handoverStatuses[detail.status] ?? detail.status
            }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{
              handoverTypes[detail.handoverType] ?? detail.handoverType
            }}</el-descriptions-item>
            <el-descriptions-item label="关联车次">{{
              detail.tripId || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="交方节点">{{
              detail.fromNodeName
            }}</el-descriptions-item>
            <el-descriptions-item label="接方节点">{{
              detail.toNodeName
            }}</el-descriptions-item>
            <el-descriptions-item label="发车时间">{{
              formatDateTime(detail.departTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="到达时间">{{
              formatDateTime(detail.arriveTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="接收人"
              >{{ detail.receiveOperator || "-" }}
              {{ formatDateTime(detail.receiveTime) }}</el-descriptions-item
            >
            <el-descriptions-item label="件数/重量"
              >{{ detail.pieceCount ?? "-" }} 件 /
              {{ detail.totalWeightKg ?? "-" }} kg</el-descriptions-item
            >
            <el-descriptions-item label="异常说明">{{
              detail.exceptionRemark || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{
              detail.remark || "-"
            }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="items-title">交接明细</h3>
          <el-table :data="detail.items ?? []" border size="small">
            <el-table-column prop="waybillNo" label="运单号" min-width="180" />
          </el-table>
          <div class="detail-actions">
            <el-button @click="openDetail(detail, true)">刷新</el-button>
            <el-button
              v-if="detail.status === 10"
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(detail, 'depart')"
              >发车</el-button
            >
            <el-button
              v-if="detail.status === 20"
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(detail, 'arrive')"
              >到达登记</el-button
            >
            <el-button
              v-if="detail.status === 30"
              type="primary"
              :disabled="Boolean(acting)"
              @click="advance(detail, 'receive')"
              >接收确认</el-button
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

.time-line {
  margin: 0;
  line-height: 1.6;
}

.items-title {
  margin: 20px 0 12px;
}

.detail-actions {
  margin-top: 16px;
}
</style>
