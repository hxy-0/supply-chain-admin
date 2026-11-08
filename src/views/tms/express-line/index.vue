<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  lineApi,
  legTypes,
  type LineHaulRoute,
  type RoutePlan
} from "@/api/tmsExpress";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import LineForm from "./LineForm.vue";

defineOptions({ name: "ExpressLine" });

const query = reactive({
  fromNodeId: undefined as string | undefined,
  toNodeId: undefined as string | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<LineHaulRoute[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const editing = shallowRef(false);
const selected = ref<LineHaulRoute>();
const nodes = ref<LogisticNode[]>([]);
const planVisible = shallowRef(false);
const planLoading = shallowRef(false);
const plan = ref<RoutePlan>();
let requestVersion = 0;

async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await lineApi.page({ ...query });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(error instanceof Error ? error.message : "线路加载失败");
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function loadNodes() {
  try {
    nodes.value = (
      await logisticNodeApi.page({ pageNum: 1, pageSize: 200 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "节点加载失败");
  }
}
function nodeName(nodeId?: string) {
  return nodes.value.find(row => row.id === nodeId)?.name ?? nodeId ?? "-";
}
function create() {
  selected.value = undefined;
  editing.value = true;
}
function edit(row: LineHaulRoute) {
  selected.value = row;
  editing.value = true;
}
async function remove(row: LineHaulRoute) {
  try {
    await ElMessageBox.confirm(
      `删除线路「${nodeName(row.fromNodeId)} → ${nodeName(row.toNodeId)}」？`,
      "删除线路",
      { type: "warning" }
    );
    await lineApi.remove(row.lineId);
    ElMessage.success("线路已删除");
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
async function showPlan(row: LineHaulRoute) {
  planVisible.value = true;
  planLoading.value = true;
  plan.value = undefined;
  try {
    plan.value = await lineApi.routePlan(row.fromNodeId, row.toNodeId);
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "线路计划加载失败"
    );
  } finally {
    planLoading.value = false;
  }
}
function reset() {
  query.fromNodeId = undefined;
  query.toNodeId = undefined;
  void load(true);
}
load(true);
loadNodes();
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>干线线路</span
          ><el-button type="primary" @click="create">新建线路</el-button>
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="起点"
          ><el-select
            v-model="query.fromNodeId"
            clearable
            filterable
            style="width: 180px"
            ><el-option
              v-for="node in nodes"
              :key="node.id"
              :value="node.id"
              :label="node.name" /></el-select
        ></el-form-item>
        <el-form-item label="终点"
          ><el-select
            v-model="query.toNodeId"
            clearable
            filterable
            style="width: 180px"
            ><el-option
              v-for="node in nodes"
              :key="node.id"
              :value="node.id"
              :label="node.name" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="lineId">
        <el-table-column label="线路" min-width="240"
          ><template #default="{ row }"
            >{{ nodeName((row as LineHaulRoute).fromNodeId) }} →
            {{ nodeName((row as LineHaulRoute).toNodeId) }}</template
          ></el-table-column
        >
        <el-table-column label="距离(km)" width="110"
          ><template #default="{ row }">{{
            (row as LineHaulRoute).distanceKm ?? "-"
          }}</template></el-table-column
        >
        <el-table-column label="时长(h)" width="100"
          ><template #default="{ row }">{{
            (row as LineHaulRoute).hours ?? "-"
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }">
            <el-tag
              :type="(row as LineHaulRoute).isEnable ? 'success' : 'info'"
              size="small"
              >{{ (row as LineHaulRoute).isEnable ? "启用" : "停用" }}</el-tag
            >
          </template></el-table-column
        >
        <el-table-column label="备注" min-width="140"
          ><template #default="{ row }">{{
            (row as LineHaulRoute).remark || "-"
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="200" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="showPlan(row as LineHaulRoute)"
              >线路计划</el-button
            >
            <el-button link type="primary" @click="edit(row as LineHaulRoute)"
              >编辑</el-button
            >
            <el-button link type="danger" @click="remove(row as LineHaulRoute)"
              >删除</el-button
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
    <el-dialog
      v-model="editing"
      :title="selected ? '编辑线路' : '新建线路'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <LineForm :line="selected" :nodes="nodes" @saved="load()" />
    </el-dialog>
    <el-dialog
      v-model="planVisible"
      title="线路计划"
      width="720px"
      destroy-on-close
    >
      <div v-loading="planLoading">
        <template v-if="plan">
          <p class="plan-summary">
            共 {{ plan.legCount ?? plan.legs.length }} 段 · 全程
            {{ plan.totalDistanceKm ?? "-" }} km ·
            {{ plan.totalHours ?? "-" }} 小时
          </p>
          <el-table :data="plan.legs" border size="small">
            <el-table-column label="段" width="60"
              ><template #default="{ row }">{{
                row.legSeq
              }}</template></el-table-column
            >
            <el-table-column label="类型" width="110"
              ><template #default="{ row }">{{
                legTypes[row.legType ?? 0] ?? row.legType
              }}</template></el-table-column
            >
            <el-table-column label="起点" min-width="140"
              ><template #default="{ row }">{{
                row.fromNodeName ?? nodeName(row.fromNodeId)
              }}</template></el-table-column
            >
            <el-table-column label="终点" min-width="140"
              ><template #default="{ row }">{{
                row.toNodeName ?? nodeName(row.toNodeId)
              }}</template></el-table-column
            >
            <el-table-column label="距离(km)" width="100"
              ><template #default="{ row }">{{
                row.distanceKm ?? "-"
              }}</template></el-table-column
            >
            <el-table-column label="时长(h)" width="90"
              ><template #default="{ row }">{{
                row.hours ?? "-"
              }}</template></el-table-column
            >
          </el-table>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-summary {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
}
</style>
