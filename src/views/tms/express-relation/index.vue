<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { relationApi, type NodeServiceRelation } from "@/api/tmsExpress";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import RelationForm from "./RelationForm.vue";

defineOptions({ name: "ExpressRelation" });

const query = reactive({
  upstreamNodeId: undefined as string | undefined,
  downstreamNodeId: undefined as string | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<NodeServiceRelation[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const editing = shallowRef(false);
const selected = ref<NodeServiceRelation>();
const nodes = ref<LogisticNode[]>([]);
let requestVersion = 0;

async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await relationApi.page({ ...query });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(
        error instanceof Error ? error.message : "配送关系加载失败"
      );
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
function edit(row: NodeServiceRelation) {
  selected.value = row;
  editing.value = true;
}
async function remove(row: NodeServiceRelation) {
  try {
    await ElMessageBox.confirm(
      `删除配送关系「${nodeName(row.upstreamNodeId)} → ${nodeName(row.downstreamNodeId)}」？`,
      "删除配送关系",
      { type: "warning" }
    );
    await relationApi.remove(row.relationId);
    ElMessage.success("配送关系已删除");
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
function reset() {
  query.upstreamNodeId = undefined;
  query.downstreamNodeId = undefined;
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
          <span>节点配送关系</span
          ><el-button type="primary" @click="create">新建关系</el-button>
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="上游节点"
          ><el-select
            v-model="query.upstreamNodeId"
            clearable
            filterable
            style="width: 180px"
            ><el-option
              v-for="node in nodes"
              :key="node.id"
              :value="node.id"
              :label="node.name" /></el-select
        ></el-form-item>
        <el-form-item label="下游节点"
          ><el-select
            v-model="query.downstreamNodeId"
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
      <el-table v-loading="loading" :data="records" row-key="relationId">
        <el-table-column label="上游节点" min-width="180"
          ><template #default="{ row }">{{
            nodeName((row as NodeServiceRelation).upstreamNodeId)
          }}</template></el-table-column
        >
        <el-table-column label="下游节点" min-width="180"
          ><template #default="{ row }">{{
            nodeName((row as NodeServiceRelation).downstreamNodeId)
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }">
            <el-tag
              :type="(row as NodeServiceRelation).isEnable ? 'success' : 'info'"
              size="small"
              >{{
                (row as NodeServiceRelation).isEnable ? "启用" : "停用"
              }}</el-tag
            >
          </template></el-table-column
        >
        <el-table-column label="备注" min-width="160"
          ><template #default="{ row }">{{
            (row as NodeServiceRelation).remark || "-"
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="150" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="edit(row as NodeServiceRelation)"
              >编辑</el-button
            >
            <el-button
              link
              type="danger"
              @click="remove(row as NodeServiceRelation)"
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
      :title="selected ? '编辑配送关系' : '新建配送关系'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <RelationForm :relation="selected" :nodes="nodes" @saved="load()" />
    </el-dialog>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
