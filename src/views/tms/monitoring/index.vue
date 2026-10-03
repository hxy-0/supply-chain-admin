<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import { monitoringApi, type VehicleLocation } from "@/api/tms";

defineOptions({ name: "TmsVehicleMonitoring" });
const route = useRoute(); const isTrack = computed(() => route.path.endsWith("/track"));
const loading = ref(false); const rows = ref<VehicleLocation[]>([]); const vehicleId = ref("");
const range = ref<[Date, Date]>([new Date(Date.now()-24*3600_000), new Date()]);
const time = (v?: number) => v ? new Date(v).toLocaleString() : "-";
async function online() { loading.value=true; try { rows.value=await monitoringApi.online(); } finally { loading.value=false; } }
async function track() { if (!vehicleId.value) return message("请输入车辆ID", {type:"warning"}); loading.value=true; try { const r=await monitoringApi.track(vehicleId.value, range.value[0].getTime(), range.value[1].getTime()); rows.value=r.locations||[]; if(r.sampled) message(`轨迹点过多，已采样为 ${r.returnedCount} 点`,{type:"info"}); } finally { loading.value=false; } }
onMounted(() => { if (!isTrack.value) online(); });
</script>
<template><div><el-card shadow="never" class="mb-4"><div class="flex flex-wrap gap-3"><template v-if="isTrack"><el-input v-model="vehicleId" placeholder="车辆ID" class="w-60"/><el-date-picker v-model="range" type="datetimerange" start-placeholder="开始时间" end-placeholder="结束时间"/><el-button type="primary" @click="track">查询轨迹</el-button></template><el-button v-else type="primary" @click="online">刷新在线车辆</el-button></div></el-card><el-card shadow="never"><el-alert class="mb-4" type="info" :closable="false" title="坐标数据已迁移；地图展示可在配置高德地图 Key 后启用。"/><el-table :data="rows" v-loading="loading"><el-table-column prop="plateNumber" label="车牌号"/><el-table-column prop="vehicleId" label="车辆ID"/><el-table-column prop="longitude" label="经度"/><el-table-column prop="latitude" label="纬度"/><el-table-column prop="speedKph" label="速度(km/h)"/><el-table-column prop="provider" label="定位来源"/><el-table-column label="定位时间"><template #default="s">{{ time(s.row.gpsTime) }}</template></el-table-column><el-table-column label="地图"><template #default="s"><el-link type="primary" target="_blank" :href="`https://uri.amap.com/marker?position=${s.row.longitude},${s.row.latitude}`">查看位置</el-link></template></el-table-column></el-table></el-card></div></template>
