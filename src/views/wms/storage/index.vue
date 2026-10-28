<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import { warehouseApi, type Warehouse } from "@/api/wms";
import {
  storageApi,
  zoneTypes,
  locationTypes,
  type Zone,
  type Location,
  type Id
} from "@/api/wmsInventory";
import StorageEditDialog from "./StorageEditDialog.vue";
import WmsLabelDialog, {
  type WarehouseLabel
} from "../components/WmsLabelDialog.vue";
defineOptions({ name: "WmsStorage" });
const warehouseId = shallowRef<Id>();
const warehouses = ref<Warehouse[]>([]);
const zones = ref<Zone[]>([]),
  locations = ref<Location[]>([]);
const selected = ref<Zone>();
const zonePage = shallowRef(1),
  locationPage = shallowRef(1),
  zoneTotal = shallowRef(0),
  locationTotal = shallowRef(0);
const zoneName = shallowRef(""),
  locationCode = shallowRef("");
const loading = shallowRef(false),
  failure = shallowRef("");
const editOpen = shallowRef(false),
  kind = shallowRef<"zone" | "location">("zone");
const editing = ref<Zone | Location>();
const checked = ref<Location[]>([]),
  labels = ref<WarehouseLabel[]>([]),
  printOpen = shallowRef(false);
let zoneSequence = 0,
  locationSequence = 0,
  warehouseSequence = 0;
async function searchWarehouses(name = "") {
  const sequence = ++warehouseSequence;
  try {
    const page = await warehouseApi.page({ name, pageNum: 1, pageSize: 200 });
    if (sequence === warehouseSequence) {
      warehouses.value = page.records;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
}
async function loadZones() {
  const sequence = ++zoneSequence;
  if (!warehouseId.value) {
    zones.value = [];
    zoneTotal.value = 0;
    loading.value = false;
    return;
  }
  loading.value = true;
  failure.value = "";
  try {
    const page = await storageApi.zones({
      warehouseId: warehouseId.value,
      name: zoneName.value,
      pageNum: zonePage.value,
      pageSize: 10
    });
    if (sequence !== zoneSequence) {
      return;
    }
    zones.value = page.records;
    zoneTotal.value = page.total;
  } catch (error) {
    if (sequence === zoneSequence) {
      failure.value = error instanceof Error ? error.message : "库区加载失败";
      zones.value = [];
    }
  } finally {
    if (sequence === zoneSequence) {
      loading.value = false;
    }
  }
}
async function loadLocations() {
  const sequence = ++locationSequence;
  checked.value = [];
  if (!selected.value) {
    locations.value = [];
    locationTotal.value = 0;
    return;
  }
  try {
    const page = await storageApi.locations({
      warehouseId: warehouseId.value,
      zoneId: selected.value.id,
      code: locationCode.value,
      pageNum: locationPage.value,
      pageSize: 20
    });
    if (sequence !== locationSequence) {
      return;
    }
    locations.value = page.records;
    locationTotal.value = page.total;
  } catch (error) {
    if (sequence === locationSequence) {
      locations.value = [];
      locationTotal.value = 0;
      ElMessage.error(error instanceof Error ? error.message : "库位加载失败");
    }
  }
}
watch(warehouseId, () => {
  selected.value = undefined;
  locations.value = [];
  checked.value = [];
  locationTotal.value = 0;
  locationSequence++;
  zonePage.value = 1;
  void loadZones();
});
function selectZone(row: Zone) {
  selected.value = row;
  locationPage.value = 1;
  locationCode.value = "";
  void loadLocations();
}
function edit(type: "zone" | "location", row?: Zone | Location) {
  kind.value = type;
  editing.value = row;
  editOpen.value = true;
}
function print() {
  const warehouse = warehouses.value.find(
    row => String(row.id) === String(warehouseId.value)
  );
  labels.value = checked.value.map(row => ({
    code: row.barcode,
    title: `库位 ${row.code}`,
    subtitle: `${warehouse?.name || warehouseId.value} / ${row.zoneName || selected.value?.name}`,
    lines: [locationTypes[row.locationType]]
  }));
  printOpen.value = true;
}
async function saved() {
  await loadZones();
  if (selected.value) {
    const fresh = zones.value.find(
      row => String(row.id) === String(selected.value?.id)
    );
    if (fresh) {
      selected.value = fresh;
    }
  }
  await loadLocations();
}
onMounted(() => void searchWarehouses());
</script>
<template>
  <el-card shadow="never">
    <template #header
      ><strong>库区库位</strong>
      <p>按实际仓库维护位置，打印标签后供现场扫码确认。</p></template
    >
    <el-form
      inline
      @submit.prevent="
        zonePage = 1;
        loadZones();
      "
    >
      <el-form-item label="仓库"
        ><el-select
          v-model="warehouseId"
          placeholder="搜索并选择仓库"
          filterable
          remote
          :remote-method="searchWarehouses"
          style="width: 260px"
          ><el-option
            v-for="row in warehouses"
            :key="row.id"
            :label="`${row.name}（${row.code}）`"
            :value="row.id" /></el-select
      ></el-form-item>
      <el-form-item label="库区名称"
        ><el-input v-model="zoneName" clearable
      /></el-form-item>
      <el-button
        :disabled="!warehouseId"
        @click="
          zonePage = 1;
          loadZones();
        "
        >查询库区</el-button
      >
      <el-button type="primary" :disabled="!warehouseId" @click="edit('zone')"
        >新增库区</el-button
      >
    </el-form>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-table
      v-loading="loading"
      :data="zones"
      row-key="id"
      empty-text="请选择仓库或新增库区"
    >
      <el-table-column prop="code" label="库区编码" /><el-table-column
        prop="name"
        label="库区名称"
      />
      <el-table-column label="用途"
        ><template #default="{ row }">{{
          zoneTypes[row.zoneType]
        }}</template></el-table-column
      >
      <el-table-column label="状态"
        ><template #default="{ row }">{{
          row.status === 0 ? "启用" : "停用"
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="200"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="selectZone(row as Zone)"
            >查看库位</el-button
          ><el-button link type="primary" @click="edit('zone', row as Zone)"
            >编辑</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="zonePage"
      :total="zoneTotal"
      :page-size="10"
      layout="prev,pager,next,total"
      @current-change="loadZones"
    />
    <h3>
      {{
        selected ? `${selected.code} · ${selected.name}` : "选择库区查看库位"
      }}
    </h3>
    <el-form
      inline
      @submit.prevent="
        locationPage = 1;
        loadLocations();
      "
      ><el-form-item label="库位编码"
        ><el-input v-model="locationCode" clearable /></el-form-item
      ><el-button
        :disabled="!selected"
        @click="
          locationPage = 1;
          loadLocations();
        "
        >查询库位</el-button
      ><el-button :disabled="!selected" type="primary" @click="edit('location')"
        >新增库位</el-button
      ><el-button :disabled="!checked.length" @click="print"
        >打印选中库位标签</el-button
      ></el-form
    >
    <el-table
      :data="locations"
      row-key="id"
      @selection-change="checked = $event"
      ><el-table-column type="selection" width="48" /><el-table-column
        prop="code"
        label="库位编码"
      /><el-table-column label="用途"
        ><template #default="{ row }">{{
          locationTypes[row.locationType]
        }}</template></el-table-column
      ><el-table-column label="状态"
        ><template #default="{ row }">{{
          ["启用·空闲", "启用·有货", "停用"][row.status]
        }}</template></el-table-column
      ><el-table-column
        prop="barcode"
        label="标签码值"
        min-width="180"
      /><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            @click="edit('location', row as Location)"
            >编辑</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-pagination
      v-model:current-page="locationPage"
      :total="locationTotal"
      :page-size="20"
      layout="prev,pager,next,total"
      @current-change="loadLocations"
    />
    <StorageEditDialog
      v-model="editOpen"
      :kind="kind"
      :warehouse-id="warehouseId"
      :zone="selected"
      :record="editing"
      @saved="saved"
    />
    <WmsLabelDialog v-model="printOpen" :labels="labels" />
  </el-card>
</template>
