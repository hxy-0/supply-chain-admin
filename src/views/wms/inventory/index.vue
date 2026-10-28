<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from "vue";
import { warehouseApi, type Warehouse } from "@/api/wms";
import {
  inventoryApi,
  movementTypes,
  type Inventory,
  type InventoryLog,
  type StockSummary,
  type Id
} from "@/api/wmsInventory";
import { formatDateTime } from "@/utils/date";
import StockTransferDialog from "./StockTransferDialog.vue";
import { useUserStoreHook } from "@/store/modules/user";
defineOptions({ name: "WmsInventory" });
const warehouses = ref<Warehouse[]>([]),
  rows = ref<Inventory[]>([]),
  logs = ref<InventoryLog[]>([]),
  summary = ref<StockSummary>();
const tab = shallowRef("stock"),
  total = shallowRef(0),
  busy = shallowRef(false),
  failure = shallowRef("");
const query = reactive({
  warehouseId: undefined as Id | undefined,
  skuId: undefined as Id | undefined,
  locationId: undefined as Id | undefined,
  skuCode: "",
  locationCode: "",
  pageNum: 1,
  pageSize: 20
});
const transferOpen = shallowRef(false),
  source = ref<Inventory>();
const pendingKey = `wms-transfer-pending:${useUserStoreHook().username}`;
const pending = shallowRef(!!sessionStorage.getItem(pendingKey));
let sequence = 0,
  warehouseSequence = 0;
async function searchWarehouses(name = "") {
  const version = ++warehouseSequence;
  try {
    const page = await warehouseApi.page({ name, pageNum: 1, pageSize: 200 });
    if (version === warehouseSequence) {
      warehouses.value = page.records;
    }
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "仓库加载失败";
  }
}
async function load() {
  const version = ++sequence;
  busy.value = true;
  failure.value = "";
  try {
    if (tab.value === "stock") {
      const page = await inventoryApi.page(query);
      if (version !== sequence) {
        return;
      }
      rows.value = page.records;
      total.value = page.total;
    } else {
      const page = await inventoryApi.logs(query);
      if (version !== sequence) {
        return;
      }
      logs.value = page.records;
      total.value = page.total;
    }
  } catch (error) {
    if (version === sequence) {
      failure.value = error instanceof Error ? error.message : "库存加载失败";
      rows.value = [];
      logs.value = [];
      total.value = 0;
    }
  } finally {
    if (version === sequence) {
      busy.value = false;
    }
  }
}
function search() {
  query.pageNum = 1;
  void load();
}
function reset() {
  query.skuId = undefined;
  query.locationId = undefined;
  query.warehouseId = undefined;
  query.skuCode = "";
  query.locationCode = "";
  search();
}
function move(row?: Inventory) {
  source.value = row;
  transferOpen.value = true;
}
async function refresh() {
  pending.value = !!sessionStorage.getItem(pendingKey);
  await load();
  try {
    summary.value = await inventoryApi.summary();
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "库存汇总加载失败";
  }
}
function showLogs(row: Inventory) {
  query.skuId = row.skuId;
  query.locationId = row.locationId;
  query.warehouseId = row.warehouseId;
  query.skuCode = row.skuCode;
  query.locationCode = row.locationCode;
  tab.value = "logs";
  search();
}
onMounted(() => {
  void searchWarehouses();
  void refresh();
});
</script>
<template>
  <el-card shadow="never">
    <template #header
      ><strong>库存中心</strong>
      <p>库存数量来自实际收货、上架、出库和移库记录。</p></template
    >
    <div v-if="summary" class="stock-summary" aria-label="全仓库库存汇总">
      <div>
        <span>全仓实物总量</span><strong>{{ summary.totalQuantity }}</strong>
      </div>
      <div>
        <span>已上架</span><strong>{{ summary.putawayQuantity }}</strong>
      </div>
      <div>
        <span>已收待上架</span
        ><strong>{{ summary.pendingPutawayQuantity }}</strong>
      </div>
      <div>
        <span>作业占用</span><strong>{{ summary.totalLockedQuantity }}</strong>
      </div>
      <div>
        <span>可分配数量</span
        ><strong>{{ summary.totalAvailableQuantity }}</strong>
      </div>
      <div>
        <span>有货SKU</span><strong>{{ summary.skuCount }}</strong>
      </div>
    </div>
    <p>
      上方为全仓汇总；下方条件筛选已上架库存及流水。数量按商品基本单位记录，不用于推算物理容量。
    </p>
    <el-form inline @submit.prevent="search"
      ><el-form-item label="仓库"
        ><el-select
          v-model="query.warehouseId"
          clearable
          filterable
          remote
          :remote-method="searchWarehouses"
          style="width: 240px"
          @change="
            query.skuId = undefined;
            query.locationId = undefined;
          "
          ><el-option
            v-for="row in warehouses"
            :key="row.id"
            :label="row.name"
            :value="row.id" /></el-select></el-form-item
      ><el-form-item label="商品SKU"
        ><el-input
          v-model="query.skuCode"
          clearable
          @input="query.skuId = undefined" /></el-form-item
      ><el-form-item label="库位编码"
        ><el-input
          v-model="query.locationCode"
          clearable
          @input="query.locationId = undefined" /></el-form-item
      ><el-button type="primary" @click="search">查询</el-button
      ><el-button @click="reset">重置</el-button
      ><el-button @click="refresh">刷新</el-button
      ><el-button v-if="pending" type="warning" @click="move()"
        >恢复未确认移库</el-button
      ></el-form
    >
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-tabs v-model="tab" @tab-change="search"
      ><el-tab-pane label="库位库存" name="stock" /><el-tab-pane
        label="库存流水"
        name="logs"
    /></el-tabs>
    <el-table v-if="tab === 'stock'" v-loading="busy" :data="rows" row-key="id"
      ><el-table-column prop="warehouseName" label="仓库" /><el-table-column
        prop="locationCode"
        label="库位"
      /><el-table-column prop="skuCode" label="SKU" /><el-table-column
        prop="skuName"
        label="商品"
        min-width="150"
      /><el-table-column prop="quantity" label="在库" /><el-table-column
        prop="lockedQuantity"
        label="作业占用"
      /><el-table-column
        prop="availableQuantity"
        label="可用"
      /><el-table-column label="更新时间" min-width="170"
        ><template #default="{ row }">{{
          formatDateTime(row.updateTime)
        }}</template></el-table-column
      ><el-table-column label="操作" width="150"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="showLogs(row as Inventory)"
            >流水</el-button
          ><el-button
            link
            type="primary"
            :disabled="row.availableQuantity <= 0 || pending"
            @click="move(row as Inventory)"
            >移库</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-table v-else v-loading="busy" :data="logs" row-key="id"
      ><el-table-column
        prop="bizNo"
        label="关联单号"
        min-width="200"
      /><el-table-column label="动作"
        ><template #default="{ row }">{{
          movementTypes[row.movementType]
        }}</template></el-table-column
      ><el-table-column prop="locationCode" label="库位" /><el-table-column
        prop="skuCode"
        label="SKU"
      /><el-table-column label="数量变化"
        ><template #default="{ row }"
          >{{ [1, 2].includes(row.movementType) ? "-" : "+"
          }}{{ row.quantity }}</template
        ></el-table-column
      ><el-table-column label="时间" min-width="170"
        ><template #default="{ row }">{{
          formatDateTime(row.createTime)
        }}</template></el-table-column
      ></el-table
    >
    <el-pagination
      v-model:current-page="query.pageNum"
      :total="total"
      :page-size="20"
      layout="prev,pager,next,total"
      @current-change="load"
    />
    <StockTransferDialog
      v-model="transferOpen"
      :source="source"
      @saved="refresh"
    />
  </el-card>
</template>
<style scoped>
.stock-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stock-summary > div {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.stock-summary span {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stock-summary strong {
  display: block;
  margin-top: 8px;
  font-size: 25px;
}
</style>
