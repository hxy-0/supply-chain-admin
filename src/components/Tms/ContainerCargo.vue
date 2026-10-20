<script setup lang="ts">
import { computed, ref } from "vue";
import type { PickupContainer } from "@/api/tmsPickupExecution";

const props = defineProps<{ containers: PickupContainer[] }>();
const selectedId = ref("");
const selected = computed(
  () =>
    props.containers.find(item => item.containerId === selectedId.value) ||
    props.containers[0]
);
const statuses: Record<string, string> = {
  PENDING: "待运输",
  RESERVED: "已预留",
  LOADED: "已装车",
  IN_TRANSIT: "在途",
  ARRIVED: "到站待卸",
  READY: "待中转",
  DELIVERED: "已交付"
};
</script>

<template>
  <section class="container-cargo" aria-label="容器货物视图">
    <div class="cargo-heading">
      <div>
        <h3>容器货物视图</h3>
        <p>选择容器，查看商品与确认数量</p>
      </div>
      <el-tag>{{ containers.length }} 个容器</el-tag>
    </div>
    <div class="cargo-layout">
      <div class="cargo-scene">
        <svg class="truck-cab" viewBox="0 0 170 150" aria-hidden="true">
          <path
            d="M159 16H95L60 31 33 83 12 100V132H159Z"
            fill="var(--tms-panel)"
            stroke="#b7bfd4"
            stroke-width="2"
          />
          <path d="M89 34H66L45 79H89Z" fill="#d5e2ee" stroke="#a7b7cb" />
          <path d="M102 30H142V85H102Z" fill="#edf0fa" stroke="#b7bfd4" />
          <path
            d="M104 96H142M20 112H46M95 112H150"
            stroke="#aab4c9"
            stroke-width="3"
          />
          <circle cx="59" cy="128" r="21" fill="#34405a" />
          <circle cx="59" cy="128" r="11" fill="#d2d8e7" />
        </svg>
        <div class="cargo-trailer">
          <div class="container-grid">
            <button
              v-for="container in containers"
              :key="container.containerId"
              type="button"
              :class="{
                active: selected?.containerId === container.containerId
              }"
              :aria-pressed="selected?.containerId === container.containerId"
              @click="selectedId = container.containerId"
            >
              <span class="container-icon" aria-hidden="true">▣</span>
              <strong>{{ container.containerCode }}</strong>
              <small class="tms-status" :data-status="container.status"
                >{{ container.items.length }} 项商品 ·
                {{ statuses[container.status] || "已确认" }}</small
              >
            </button>
          </div>
          <el-empty
            v-if="!containers.length"
            :image-size="45"
            description="尚无实提容器"
          />
        </div>
      </div>
      <aside v-if="selected" class="cargo-details">
        <h4>{{ selected.containerCode }}</h4>
        <p>
          {{ statuses[selected.status] || "已确认" }} · 参考重量
          {{ selected.weightKg == null ? "未知" : `${selected.weightKg} kg` }}
        </p>
        <div
          v-for="item in selected.items"
          :key="item.containerItemId"
          class="cargo-item"
        >
          <span>{{ item.goodsName }}</span
          ><strong>{{ item.quantity }} {{ item.unit }}</strong>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.container-cargo {
  padding: 22px;
  margin: 22px 0;
  background: var(--tms-soft);
  border: 1px solid var(--tms-line);
  border-radius: 16px;
}

.cargo-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

h3,
h4 {
  margin: 0;
  font-size: 16px;
}

p {
  margin: 8px 0;
  font-size: 12px;
  color: var(--tms-muted);
}

.cargo-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(200px, 1fr);
  gap: 22px;
}

.cargo-scene {
  display: flex;
  align-items: flex-end;
  min-width: 0;
  padding-bottom: 22px;
}

.truck-cab {
  flex-shrink: 0;
  width: 100px;
  margin-right: -8px;
  margin-bottom: -14px;
}

.cargo-trailer {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 155px;
  padding: 12px;
  background: var(--tms-panel);
  border: 2px solid var(--tms-line);
  border-bottom: 7px solid #b9c2d7;
  border-radius: 6px;
}

.cargo-trailer::after {
  position: absolute;
  right: 18%;
  bottom: -24px;
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  content: "";
  background: #d2d8e7;
  border: 9px solid #34405a;
  border-radius: 50%;
  box-shadow:
    42px 0 0 -9px #d2d8e7,
    42px 0 0 0 #34405a;
}

.container-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow: auto;
}

button {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: var(--tms-soft);
  border: 1px solid var(--tms-line);
  border-radius: 7px;
}

button.active {
  background: var(--tms-accent-soft);
  border-color: var(--tms-accent);
}

button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

button strong {
  width: 100%;
  font-size: 11px;
  overflow-wrap: anywhere;
}

small {
  font-size: 10px;
  color: var(--tms-muted);
}

.container-icon {
  font-size: 24px;
  color: var(--tms-accent);
}

.cargo-details {
  padding: 16px;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 12px;
}

.cargo-details h4 {
  overflow-wrap: anywhere;
}

.cargo-item {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 12px;
  border-top: 1px solid var(--tms-line);
}

@media (width <= 700px) {
  .cargo-layout {
    grid-template-columns: 1fr;
  }

  .truck-cab {
    width: 70px;
  }
}
</style>
