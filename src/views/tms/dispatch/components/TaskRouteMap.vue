<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { logisticNodeApi } from "@/api/tms";
import type { PickupTask } from "@/api/tmsPickup";
import AmapView from "@/components/Tms/AmapView.vue";
import { buildRoutePoints } from "../routePoints";

const props = defineProps<{
  stops: PickupTask["stops"];
  activeNodeId?: string;
}>();
const emit = defineEmits<{ select: [nodeId: string] }>();
const points = ref<
  { nodeId: string; label: string; longitude: number; latitude: number }[]
>([]);
const missing = ref(0);
const loading = ref(false);
let version = 0;
watch(
  () => props.stops,
  async stops => {
    const current = ++version;
    points.value = [];
    missing.value = 0;
    loading.value = true;
    try {
      const results = await Promise.allSettled(
        stops.map(stop => logisticNodeApi.get(stop.nodeId))
      );
      if (current !== version) return;
      points.value = buildRoutePoints(stops, results);
      missing.value = stops.length - points.value.length;
    } finally {
      if (current === version) loading.value = false;
    }
  },
  { immediate: true }
);
onUnmounted(() => {
  ++version;
});
</script>

<template>
  <section v-loading="loading" class="task-route-map">
    <header>
      <h3>计划路线地图</h3>
      <small>节点连线示意 · 实际行驶路线查看车辆轨迹</small>
    </header>
    <el-alert
      v-if="missing"
      :title="`${missing} 个节点坐标缺失或无查看权限，地图只展示可用节点`"
      type="warning"
      :closable="false"
    />
    <AmapView
      v-if="points.length"
      :points="points"
      :route="!missing"
      :active-point-id="activeNodeId"
      height="340px"
      @point-click="point => point.nodeId && emit('select', point.nodeId)"
    />
    <el-empty
      v-else-if="!loading"
      description="暂无可展示的节点坐标"
      :image-size="60"
    />
  </section>
</template>

<style scoped>
.task-route-map {
  margin: 18px 0;
  overflow: hidden;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 12px;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

h3 {
  margin: 0;
  font-size: 14px;
}

small {
  font-size: 11px;
  color: var(--tms-muted);
}
</style>
