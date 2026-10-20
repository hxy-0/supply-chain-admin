<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PickupTask } from "@/api/tmsPickup";
import { formatDateTime } from "@/utils/date";
import PlanTimeline from "./PlanTimeline.vue";
import TaskRouteMap from "./TaskRouteMap.vue";

const props = defineProps<{ tasks: PickupTask[] }>();
const selectedId = ref("");
const activeNodeId = ref("");
const selected = computed(
  () =>
    props.tasks.find(task => task.pickupTaskId === selectedId.value) ||
    props.tasks[0]
);
const stops = computed(() =>
  [...(selected.value?.stops || [])].sort(
    (left, right) => left.stopSeq - right.stopSeq
  )
);
watch(selected, () => {
  activeNodeId.value = "";
});
</script>

<template>
  <div class="route-workbench">
    <nav class="task-picker" aria-label="路线任务选择">
      <button
        v-for="task in tasks"
        :key="task.pickupTaskId"
        type="button"
        :class="{ selected: selected?.pickupTaskId === task.pickupTaskId }"
        :aria-pressed="selected?.pickupTaskId === task.pickupTaskId"
        @click="selectedId = task.pickupTaskId"
      >
        <strong>{{ task.taskNo }}</strong>
        <p>{{ task.pickupAddress }}</p>
        <small
          >{{ task.carrierName || "未登记承运人名称" }} ·
          {{ task.stops.length }} 个停靠节点</small
        >
      </button>
      <el-empty v-if="!tasks.length" description="尚未添加提货任务" />
    </nav>
    <section v-if="selected" class="route-detail">
      <header>
        <div>
          <small>计划路线</small>
          <h3>{{ selected.taskNo }}</h3>
        </div>
        <el-tag>{{ stops.length }} 个停靠节点</el-tag>
      </header>
      <p class="route-contact">
        联系人：{{
          selected.contacts
            .map(contact => `${contact.name} ${contact.phone}`)
            .join("；")
        }}
      </p>
      <TaskRouteMap
        :stops="stops"
        :active-node-id="activeNodeId"
        @select="activeNodeId = $event"
      />
      <ol class="route-stops">
        <li
          v-for="stop in stops"
          :key="stop.stopId"
          :class="{ 'active-stop': activeNodeId === stop.nodeId }"
        >
          <button
            type="button"
            class="stop-number"
            :aria-label="`定位节点 ${stop.nodeName}`"
            @click="activeNodeId = stop.nodeId"
          >
            {{ stop.stopSeq }}
          </button>
          <div>
            <strong>{{ stop.nodeName }}</strong>
            <p>计划到达：{{ formatDateTime(stop.plannedArrivalTime) }}</p>
            <p>计划发车：{{ formatDateTime(stop.plannedDepartureTime) }}</p>
            <p>实际到达：{{ formatDateTime(stop.arrivedTime) }}</p>
            <p>实际发车：{{ formatDateTime(stop.departedTime) }}</p>
          </div>
        </li>
      </ol>
      <el-empty v-if="!stops.length" description="尚未设置停靠节点" />
      <h4>任务货物</h4>
      <el-table :data="selected.items" size="small"
        ><el-table-column
          prop="goodsName"
          label="商品"
          min-width="120" /><el-table-column
          prop="plannedQuantity"
          label="计划量" /><el-table-column
          prop="pickedQuantity"
          label="实提量" /><el-table-column prop="unit" label="单位" width="65"
      /></el-table>
    </section>
    <PlanTimeline
      class="route-schedule"
      :tasks="tasks"
      :selected-task-id="selected?.pickupTaskId"
      @select="selectedId = $event"
    />
  </div>
</template>

<style scoped>
.route-workbench {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 22px;
  margin: 20px 0;
}

.task-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
  overflow: auto;
}

button {
  padding: 20px;
  text-align: left;
  cursor: pointer;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 12px;
}

button.selected {
  background: var(--tms-accent-soft);
  border-color: var(--tms-accent);
}

button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

p,
small {
  font-size: 12px;
  color: var(--tms-muted);
}

p {
  margin: 10px 0;
}

.route-detail {
  min-width: 0;
  padding: 24px;
  background: var(--tms-soft);
  border-top: 3px solid var(--tms-accent);
  border-radius: 16px;
}

.route-schedule {
  grid-column: 1 / -1;
}

.active-stop {
  color: var(--tms-accent);
}

header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

h3 {
  margin-top: 8px;
  font-size: 22px;
}

h4 {
  margin: 24px 0 14px;
  font-size: 14px;
}

.route-stops {
  padding: 0;
  margin: 26px 0;
  list-style: none;
}

.route-stops li {
  position: relative;
  display: flex;
  gap: 16px;
  padding-bottom: 18px;
}

.route-stops li:not(:last-child)::before {
  position: absolute;
  top: 30px;
  bottom: 0;
  left: 15px;
  content: "";
  border-left: 1px dashed var(--el-color-primary-light-5);
}

.stop-number {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  color: var(--el-color-primary);
  background: var(--tms-panel);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 50%;
}

@media (width <= 800px) {
  .route-workbench {
    grid-template-columns: 1fr;
  }

  .task-picker {
    flex-direction: row;
  }

  .task-picker button {
    min-width: 220px;
  }
}
</style>
