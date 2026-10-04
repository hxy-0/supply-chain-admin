<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import {
  vehicleApi,
  vehicleTrackApi,
  formatTime,
  type Vehicle,
  type VehicleLocation,
  type VehicleTrackResult
} from "@/api/tms";
import AmapView from "@/components/Tms/AmapView.vue";
import BusinessDrawer from "@/components/Tms/BusinessDrawer.vue";
defineOptions({ name: "TmsVehicleMonitoring" });
const route = useRoute();
const isTrack = computed(() => route.path.endsWith("/track"));
const loading = ref(false),
  detailsOpen = ref(false),
  rows = ref<VehicleLocation[]>([]),
  vehicles = ref<Vehicle[]>([]),
  vehicleId = ref(""),
  selectedId = ref("");
const range = ref<[Date, Date]>([
  new Date(Date.now() - 24 * 3600_000),
  new Date()
]);
const result = ref<VehicleTrackResult>(),
  autoRefresh = ref(false),
  playing = ref(false),
  index = ref(0),
  speed = ref(1);
const selected = computed(() =>
  rows.value.find(r => r.vehicleId === selectedId.value)
);
const mapRows = computed(() =>
  !isTrack.value && selected.value ? [selected.value] : rows.value
);
let requestId = 0;
function report(error: unknown) {
  message(String(error), { type: "error" });
}
async function online() {
  const version = ++requestId;
  loading.value = true;
  try {
    const list = await vehicleTrackApi.online();
    if (version !== requestId) return;
    rows.value = list;
    if (!list.some(r => r.vehicleId === selectedId.value))
      selectedId.value = "";
  } finally {
    if (version === requestId) loading.value = false;
  }
}
async function track() {
  if (!vehicleId.value || !range.value?.[0] || !range.value?.[1])
    return message("请选择车辆和时间范围", { type: "warning" });
  const start = range.value[0].getTime(),
    end = range.value[1].getTime();
  if (start >= end)
    return message("结束时间必须晚于开始时间", { type: "warning" });
  if (end - start > 24 * 3600_000)
    return message("单次查询最长为24小时", { type: "warning" });
  const version = ++requestId;
  loading.value = true;
  playing.value = false;
  index.value = 0;
  try {
    const data = await vehicleTrackApi.track(vehicleId.value, start, end);
    if (version !== requestId) return;
    result.value = data;
    rows.value = data.locations || [];
  } finally {
    if (version === requestId) loading.value = false;
  }
}
async function loadVehicles() {
  const list: Vehicle[] = [];
  let pageNum = 1;
  while (true) {
    const page = await vehicleApi.page({ pageNum, pageSize: 100 });
    list.push(...page.records);
    if (!page.records.length || list.length >= page.total) break;
    pageNum++;
  }
  vehicles.value = list;
}
watch(isTrack, () => {
  ++requestId;
  loading.value = false;
  playing.value = false;
  rows.value = [];
  result.value = undefined;
  index.value = 0;
  if (!isTrack.value) online().catch(report);
});
onMounted(() => {
  loadVehicles().catch(report);
  if (!isTrack.value) online().catch(report);
});
const refreshTimer = setInterval(() => {
  if (autoRefresh.value && !isTrack.value && !loading.value)
    online().catch(report);
}, 10000);
const playTimer = setInterval(() => {
  if (!playing.value) return;
  index.value = Math.min(index.value + speed.value, rows.value.length - 1);
  if (index.value >= rows.value.length - 1) playing.value = false;
}, 500);
onUnmounted(() => {
  ++requestId;
  clearInterval(refreshTimer);
  clearInterval(playTimer);
});
function play() {
  if (index.value >= rows.value.length - 1) index.value = 0;
  playing.value = !playing.value;
}
</script>
<template>
  <div class="monitoring-page">
    <el-card shadow="never" class="monitoring-filters"
      ><div class="flex flex-wrap gap-3">
        <template v-if="isTrack"
          ><el-select
            v-model="vehicleId"
            filterable
            placeholder="选择车辆"
            style="width: 220px"
            ><el-option
              v-for="v in vehicles"
              :key="v.id"
              :value="v.id"
              :label="v.plateNumber"
          /></el-select>
          <div class="track-time-range">
            <el-date-picker
              v-model="range"
              type="datetimerange"
              style="width: 100%"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
            />
          </div>
          <el-button
            type="primary"
            :loading="loading"
            @click="track().catch(report)"
            >查询轨迹</el-button
          ></template
        >
        <template v-else
          ><el-select
            v-model="selectedId"
            filterable
            clearable
            placeholder="定位在线车辆"
            style="width: 240px"
            ><el-option
              v-for="v in rows"
              :key="v.vehicleId"
              :value="v.vehicleId"
              :label="v.plateNumber || v.vehicleId" /></el-select
          ><el-button
            type="primary"
            :loading="loading"
            @click="online().catch(report)"
            >刷新在线车辆</el-button
          ><el-switch v-model="autoRefresh" active-text="每10秒刷新" /><span
            >在线 {{ rows.length }} 辆</span
          ></template
        >
        <el-button @click="detailsOpen = true">定位明细</el-button>
      </div></el-card
    >
    <div v-loading="loading" class="monitoring-map">
      <el-alert
        v-if="result?.sampled"
        class="sampling-notice"
        type="info"
        :closable="false"
        :title="`轨迹点较多，已增大取点间隔：${result.originalCount} 点抽稀为 ${result.returnedCount} 点，保留起点和终点`"
      />
      <AmapView
        class="map-view"
        height="100%"
        :points="mapRows"
        :track="isTrack"
        :active-index="index"
      />
      <div v-if="isTrack && rows.length" class="track-player">
        <div class="flex gap-3">
          <el-button @click="play">{{ playing ? "暂停" : "播放" }}</el-button
          ><el-button
            @click="
              playing = false;
              index = 0;
            "
            >重置</el-button
          ><el-select v-model="speed" style="width: 110px"
            ><el-option
              v-for="value in [1, 2, 4, 8]"
              :key="value"
              :value="value"
              :label="`${value}倍速`" /></el-select
          ><span
            >{{ index + 1 }} / {{ rows.length }} ·
            {{ formatTime(rows[index]?.gpsTime) }} ·
            {{ rows[index]?.speedKph ?? 0 }} km/h</span
          >
        </div>
        <el-slider
          v-model="index"
          :max="Math.max(1, rows.length - 1)"
          :show-tooltip="false"
          @input="playing = false"
        />
      </div>
    </div>
    <BusinessDrawer v-model="detailsOpen" title="定位明细" size="80%"
      ><el-table
        v-loading="loading"
        :data="rows"
        max-height="420"
        @row-click="
          row => {
            if (!isTrack) selectedId = row.vehicleId;
          }
        "
        ><el-table-column prop="plateNumber" label="车牌号" /><el-table-column
          prop="vehicleId"
          label="车辆ID"
          min-width="170"
        /><el-table-column prop="longitude" label="经度" /><el-table-column
          prop="latitude"
          label="纬度"
        /><el-table-column prop="speedKph" label="速度(km/h)" /><el-table-column
          prop="provider"
          label="来源"
        /><el-table-column label="定位时间" min-width="180"
          ><template #default="s">{{
            formatTime(s.row.gpsTime)
          }}</template></el-table-column
        ></el-table
      ></BusinessDrawer
    >
  </div>
</template>

<style scoped>
.monitoring-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 140px);
  min-height: 400px;
}

.monitoring-filters {
  flex-shrink: 0;
}

.monitoring-map {
  position: relative;
  flex: 1;
  min-height: 0;
}

.map-view {
  height: 100%;
}

.track-player,
.sampling-notice {
  position: absolute;
  z-index: 10;
  background: white;
  border-radius: 6px;
}

.track-player {
  right: 64px;
  bottom: 16px;
  left: 16px;
  padding: 12px 20px;
}

.track-player > div {
  flex-wrap: wrap;
  align-items: center;
}

.sampling-notice {
  top: 16px;
  left: 16px;
  width: auto;
  max-width: calc(100% - 32px);
}

.track-time-range {
  flex: 0 0 auto;
  width: 420px;
  min-width: 0;
  max-width: 100%;
}
</style>
