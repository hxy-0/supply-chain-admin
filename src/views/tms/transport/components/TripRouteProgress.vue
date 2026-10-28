<script setup lang="ts">
import type { Trip } from "@/api/tmsTransport";
import { formatDateTime } from "@/utils/date";
defineProps<{ trip: Trip }>();
const labels = { PENDING: "待到站", ARRIVED: "已签到", DEPARTED: "已离站" };
</script>
<template>
  <section class="route-progress">
    <el-empty
      v-if="!trip.stops.length"
      description="暂未安排停靠点"
      :image-size="70"
    />
    <ol v-else class="route-list">
      <li
        v-for="(stop, index) in trip.stops"
        :key="stop.stopId"
        :class="['route-stop', stop.status.toLowerCase()]"
      >
        <span class="stop-marker">{{ index + 1 }}</span>
        <div class="stop-content">
          <div class="stop-title">
            <strong>{{ stop.nodeName || stop.nodeId }}</strong
            ><el-tag
              size="small"
              :type="stop.status === 'PENDING' ? 'info' : 'success'"
              >{{ labels[stop.status] }}</el-tag
            >
          </div>
          <div class="stop-role">
            {{
              index === 0
                ? "始发点"
                : index === trip.stops.length - 1
                  ? "终点"
                  : "经停点"
            }}
          </div>
          <dl class="stop-times">
            <div>
              <dt>计划到达</dt>
              <dd>{{ formatDateTime(stop.plannedArrivalTime) }}</dd>
            </div>
            <div>
              <dt>实际签到</dt>
              <dd>{{ formatDateTime(stop.arrivedTime) }}</dd>
            </div>
            <div>
              <dt>计划离站</dt>
              <dd>{{ formatDateTime(stop.plannedDepartureTime) }}</dd>
            </div>
            <div>
              <dt>实际离站</dt>
              <dd>{{ formatDateTime(stop.departedTime) }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ol>
  </section>
</template>
<style scoped>
.route-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 32px;
  padding: 20px;
  margin: 0;
  list-style: none;
  background: var(--tms-soft);
  border-radius: 12px;
}

.route-stop {
  position: relative;
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
}

.stop-marker {
  display: grid;
  flex: 0 0 30px;
  place-items: center;
  height: 30px;
  font-size: 12px;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 50%;
}

.arrived .stop-marker {
  color: white;
  background: var(--el-color-primary);
}

.departed .stop-marker {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success);
}

.stop-content {
  flex: 1;
  min-width: 0;
}

.stop-title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.stop-role {
  margin: 6px 0 14px;
  font-size: 12px;
  color: var(--tms-muted);
}

.stop-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
}

.stop-times dt {
  font-size: 12px;
  color: var(--tms-muted);
}

.stop-times dd {
  margin: 4px 0 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

@media (width <= 800px) {
  .route-list {
    grid-template-columns: 1fr;
  }
}
</style>
