<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { warehouseApi, type Warehouse } from "@/api/wms";
import { formatDateTime } from "@/utils/date";
import WarehouseEditDialog from "./WarehouseEditDialog.vue";

defineOptions({ name: "WmsWarehouse" });
const query = reactive({
  code: "",
  name: "",
  status: undefined as number | undefined,
  warehouseType: undefined as number | undefined,
  pageNum: 1,
  pageSize: 10
});
const rows = ref<Warehouse[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const failure = shallowRef("");
const editOpen = shallowRef(false);
const editing = ref<Warehouse>();
const changing = shallowRef<number>();
let sequence = 0;
async function load() {
  const request = ++sequence;
  loading.value = true;
  failure.value = "";
  try {
    const page = await warehouseApi.page(query);
    if (request !== sequence) {
      return;
    }
    rows.value = page.records;
    total.value = page.total;
  } catch (error) {
    if (request === sequence) {
      failure.value = error instanceof Error ? error.message : "仓库加载失败";
    }
  } finally {
    if (request === sequence) {
      loading.value = false;
    }
  }
}
function search() {
  query.pageNum = 1;
  void load();
}
function edit(row?: Warehouse) {
  editing.value = row;
  editOpen.value = true;
}
async function changeStatus(row: Warehouse) {
  if (changing.value !== undefined) {
    return;
  }
  const status = row.status === 0 ? 1 : 0;
  try {
    await ElMessageBox.confirm(
      `${status === 1 ? "停用" : "启用"}仓库“${row.name}”？历史数据会保留。`,
      "仓库状态"
    );
  } catch {
    return;
  }
  changing.value = row.id;
  try {
    await warehouseApi.status(row.id, status);
    ElMessage.success("仓库状态已更新");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "状态更新失败");
  } finally {
    changing.value = undefined;
  }
}
onMounted(load);
</script>

<template>
  <div class="warehouse-page">
    <header>
      <div>
        <h2>仓库管理</h2>
        <p>维护仓库资料和启停状态，历史仓库不删除。</p>
      </div>
      <el-button type="primary" @click="edit()">新增仓库</el-button>
    </header>
    <el-card shadow="never">
      <el-form inline @submit.prevent="search">
        <el-form-item label="编码"
          ><el-input
            v-model="query.code"
            clearable
            maxlength="64"
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="名称"
          ><el-input
            v-model="query.name"
            clearable
            maxlength="128"
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="类型"
          ><el-select
            v-model="query.warehouseType"
            clearable
            style="width: 120px"
            ><el-option
              v-for="(label, value) in ['自营仓', '云仓', '中转仓']"
              :key="value"
              :label="label"
              :value="value" /></el-select
        ></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 120px"
            ><el-option label="启用" :value="0" /><el-option
              label="停用"
              :value="1" /></el-select
        ></el-form-item>
        <el-form-item
          ><el-button :loading="loading" @click="search"
            >查询</el-button
          ></el-form-item
        >
      </el-form>
      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="code" label="编码" min-width="130" />
        <el-table-column prop="name" label="仓库名称" min-width="160" />
        <el-table-column label="类型" width="90"
          ><template #default="{ row }">{{
            ["自营仓", "云仓", "中转仓"][row.warehouseType]
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.status === 0 ? 'success' : 'info'">{{
              row.status === 0 ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="下架策略" width="190"
          ><template #default="{ row }">{{
            [
              "按库位顺序",
              "库存行创建时间升序",
              "库存行创建时间降序",
              "部分数量优先"
            ][row.removalStrategy ?? 0]
          }}</template></el-table-column
        >
        <el-table-column
          prop="logisticNodeName"
          label="物流节点"
          min-width="150"
        />
        <el-table-column prop="contactPerson" label="联系人" width="100" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column
          prop="address"
          label="地址"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column label="更新时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.updateTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="150" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row as Warehouse)"
              >修改</el-button
            ><el-button
              link
              :type="row.status === 0 ? 'warning' : 'success'"
              :disabled="changing !== undefined"
              @click="changeStatus(row as Warehouse)"
              >{{ row.status === 0 ? "停用" : "启用" }}</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
      />
    </el-card>
    <WarehouseEditDialog
      v-model="editOpen"
      :warehouse="editing"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.warehouse-page {
  padding: 20px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 8px;
  font-size: 24px;
}

p {
  color: var(--el-text-color-secondary);
}

.el-pagination {
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
