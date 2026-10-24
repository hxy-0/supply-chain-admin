<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { dispatchApi, type VehicleTrip } from "@/api/tmsDispatch";
import { formatDateTime } from "@/utils/date";
import ContainerCargo from "@/components/Tms/ContainerCargo.vue";
import TaskRouteMap from "../../dispatch/components/TaskRouteMap.vue";

const props = defineProps<{ vehicleId: string }>();
const rows = ref<VehicleTrip[]>([]),
  total = ref(0),
  page = ref(1),
  loading = ref(false);
const selectedId = ref(""),
  activeNodeId = ref("");
const selected = computed(
  () => rows.value.find(row => row.tripId === selectedId.value) || rows.value[0]
);
const labels: Record<string, string> = {
  PENDING_ASSIGNMENT: "待指派",
  PENDING_EXECUTION: "待执行",
  WAITING_DEPARTURE: "待发车",
  IN_TRANSIT: "运输中",
  DELIVERED: "已送达",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
let version = 0;
async function load() {
  const current = ++version;
  loading.value = true;
  try {
    const result = await dispatchApi.vehicleTrips(props.vehicleId, page.value);
    if (current !== version) return;
    rows.value = result.records;
    total.value = result.total;
    selectedId.value = "";
    activeNodeId.value = "";
  } catch (reason) {
    if (current === version)
      ElMessage.error(
        reason instanceof Error ? reason.message : "车次加载失败"
      );
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(
  () => props.vehicleId,
  () => {
    page.value = 1;
    rows.value = [];
    void load();
  },
  { immediate: true }
);
watch(selected, () => {
  activeNodeId.value = "";
});
onUnmounted(() => {
  version++;
});
</script>
<template>
  <div v-loading="loading" class="vehicle-transport">
    <div class="mb-4 flex-bc">
      <span>实际分配给该车辆的运输车次</span
      ><el-button :disabled="loading" @click="load">刷新</el-button>
    </div>
    <el-table
      :data="rows"
      highlight-current-row
      @row-click="row => (selectedId = row.tripId)"
    >
      <el-table-column
        prop="tripNo"
        label="车次号"
        min-width="200"
      /><el-table-column label="状态" width="110"
        ><template #default="{ row }"
          ><span class="tms-status" :data-status="row.status">{{
            labels[row.status] || row.status
          }}</span></template
        ></el-table-column
      ><el-table-column label="计划发车" width="180"
        ><template #default="{ row }">{{
          formatDateTime(row.plannedDepartureTime)
        }}</template></el-table-column
      ><el-table-column label="容器数" width="90"
        ><template #default="{ row }">{{
          row.containers.length
        }}</template></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="10"
      layout="total,prev,pager,next"
      class="my-4"
      @current-change="load"
    />
    <template v-if="selected">
      <h3 class="mb-4">{{ selected.tripNo }} · 路线与装载</h3>
      <el-descriptions :column="2"
        ><el-descriptions-item label="实际发车">{{
          formatDateTime(selected.actualDepartureTime)
        }}</el-descriptions-item
        ><el-descriptions-item label="完成时间">{{
          formatDateTime(selected.completedTime)
        }}</el-descriptions-item></el-descriptions
      >
      <TaskRouteMap
        :stops="selected.stops"
        :active-node-id="activeNodeId"
        @select="activeNodeId = $event"
      />
      <div class="mb-4 flex flex-wrap gap-2">
        <el-button
          v-for="stop in selected.stops"
          :key="stop.stopId"
          :type="activeNodeId === stop.nodeId ? 'primary' : 'default'"
          @click="activeNodeId = stop.nodeId"
          >{{ stop.stopSeq }} · {{ stop.nodeName }}</el-button
        >
      </div>
      <ContainerCargo :containers="selected.containers" />
    </template>
    <el-empty v-else-if="!loading" description="该车辆尚未分配运输车次" />
  </div>
</template>
