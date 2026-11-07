<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { warehouseApi, type Warehouse } from "@/api/wms";
import { formatDateTime } from "@/utils/date";
import { shelfApi, shelfStatuses, type Shelf } from "@/api/wmsShelf";
import ShelfEditDialog from "./ShelfEditDialog.vue";
import ShelfSlotsDialog from "./ShelfSlotsDialog.vue";

defineOptions({ name: "WmsShelf" });
const warehouses = shallowRef<Warehouse[]>([]);
const warehouseId = shallowRef();
const code = shallowRef(""),
  status = shallowRef();
const rows = shallowRef<Shelf[]>([]);
const page = shallowRef(1),
  total = shallowRef(0);
const loading = shallowRef(false),
  failure = shallowRef("");
const editOpen = shallowRef(false),
  editing = ref<Shelf>();
const previewOpen = shallowRef(false),
  previewRow = shallowRef<Shelf>();
let sequence = 0;

onMounted(() => {
  void searchWarehouses();
  void load();
});
async function searchWarehouses(name = "") {
  try {
    const result = await warehouseApi.page({ name, pageNum: 1, pageSize: 200 });
    warehouses.value = result.records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
}
async function load(pageNum = 1) {
  const version = ++sequence;
  loading.value = true;
  failure.value = "";
  const query: Record<string, unknown> = {
    code: code.value.trim(),
    pageNum,
    pageSize: 20
  };
  if (warehouseId.value) {
    query.warehouseId = warehouseId.value;
  }
  if (
    status.value !== undefined &&
    status.value !== null &&
    status.value !== ""
  ) {
    query.status = status.value;
  }
  try {
    const result = await shelfApi.page(query);
    if (version !== sequence) {
      return;
    }
    rows.value = result.records;
    total.value = result.total;
    page.value = pageNum;
  } catch (error) {
    if (version === sequence) {
      failure.value = error instanceof Error ? error.message : "货架加载失败";
    }
  } finally {
    if (version === sequence) {
      loading.value = false;
    }
  }
}
function search() {
  void load(1);
}
function reset() {
  warehouseId.value = undefined;
  code.value = "";
  status.value = undefined;
  search();
}
function create() {
  editing.value = undefined;
  editOpen.value = true;
}
function edit(row: Shelf) {
  editing.value = row;
  editOpen.value = true;
}
async function toggleStatus(row: Shelf) {
  const next = row.status === 0 ? 1 : 0;
  const action = next === 1 ? "停用" : "启用";
  try {
    await ElMessageBox.confirm(
      next === 1
        ? `停用货架 ${row.code} 会同时停用其全部仓位，确定继续？`
        : `启用货架 ${row.code} 将按真实库存恢复仓位状态，确定继续？`,
      `${action}货架`,
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await shelfApi.save({
      id: row.id,
      warehouseId: row.warehouseId,
      zoneId: row.zoneId,
      code: row.code,
      shelfLevel: row.shelfLevel,
      shelfColumn: row.shelfColumn,
      status: next,
      remark: row.remark
    });
    ElMessage.success(`${action}成功`);
    void load(page.value);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${action}失败`);
  }
}
</script>
<template>
  <el-card shadow="never">
    <template #header
      ><strong>货架管理</strong>
      <p>
        货架按「层×列」规格自动生成仓位（库位），编码 = 前缀 + 两位层号 +
        两位列号。
      </p></template
    >
    <el-form inline @submit.prevent="search">
      <el-form-item label="仓库"
        ><el-select
          v-model="warehouseId"
          placeholder="全部仓库"
          clearable
          filterable
          remote
          :remote-method="searchWarehouses"
          style="width: 240px"
          ><el-option
            v-for="row in warehouses"
            :key="row.id"
            :label="`${row.name}（${row.code}）`"
            :value="row.id" /></el-select
      ></el-form-item>
      <el-form-item label="编码前缀"
        ><el-input v-model="code" clearable maxlength="16"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select v-model="status" clearable style="width: 120px"
          ><el-option
            v-for="(name, index) in shelfStatuses"
            :key="index"
            :label="name"
            :value="index" /></el-select
      ></el-form-item>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button type="primary" plain @click="create">新增货架</el-button>
    </el-form>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" empty-text="暂无货架">
      <el-table-column prop="code" label="编码前缀" min-width="90" />
      <el-table-column
        prop="warehouseName"
        label="所属仓库"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        prop="zoneName"
        label="所属库区"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="规格" width="100"
        ><template #default="{ row }"
          >{{ row.shelfLevel }} 层 × {{ row.shelfColumn }} 列</template
        ></el-table-column
      >
      <el-table-column prop="slotCount" label="仓位数" width="80" />
      <el-table-column label="仓位范围" min-width="150"
        ><template #default="{ row }"
          >{{ row.firstSlotCode }} ~ {{ row.lastSlotCode }}</template
        ></el-table-column
      >
      <el-table-column label="状态" width="80"
        ><template #default="{ row }"
          ><el-tag :type="row.status === 0 ? 'success' : 'info'">{{
            shelfStatuses[row.status]
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column
        prop="remark"
        label="备注"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" width="170"
        ><template #default="{ row }">{{
          formatDateTime(row.updateTime)
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="210" fixed="right"
        ><template #default="{ row }"
          ><el-button
            size="small"
            @click="
              previewRow = row as Shelf;
              previewOpen = true;
            "
            >仓位预览</el-button
          ><el-button
            size="small"
            type="primary"
            plain
            @click="edit(row as Shelf)"
            >编辑</el-button
          ><el-button
            size="small"
            :type="row.status === 0 ? 'danger' : 'success'"
            plain
            @click="toggleStatus(row as Shelf)"
            >{{ row.status === 0 ? "停用" : "启用" }}</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="20"
      layout="prev,pager,next,total"
      @current-change="load"
    />
    <ShelfEditDialog
      v-model="editOpen"
      :warehouses="warehouses"
      :record="editing"
      @saved="
        page = 1;
        load();
      "
    />
    <ShelfSlotsDialog v-model="previewOpen" :shelf="previewRow" />
  </el-card>
</template>
