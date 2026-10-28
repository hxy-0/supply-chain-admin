<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { orderApi, type OrderTransport } from "@/api/tmsOrder";
import { formatDateTime } from "@/utils/date";

const props = defineProps<{ orderId: string }>();
const router = useRouter();
const events: { field: keyof OrderTransport; label: string }[] = [
  { field: "pickedTime", label: "初始实提" },
  { field: "reservedTime", label: "绑定车次" },
  { field: "loadedTime", label: "装车" },
  { field: "departedTime", label: "发车" },
  { field: "arrivedTime", label: "到站签到" },
  { field: "unloadedTime", label: "实际卸货" }
];
const rows = ref<OrderTransport[]>([]);
const loading = ref(false);
const error = ref("");
let version = 0;
const statuses: Record<string, string> = {
  PENDING_ASSIGNMENT: "待指派",
  PENDING_EXECUTION: "待执行",
  WAITING_DEPARTURE: "待发车",
  IN_TRANSIT: "运输中",
  DELIVERED: "已送达",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const segmentStatuses: Record<string, string> = {
  RESERVED: "已预留",
  LOADED: "已装车",
  UNLOADED: "已卸货",
  CANCELLED: "已取消"
};
async function load() {
  const current = ++version;
  rows.value = [];
  loading.value = true;
  error.value = "";
  try {
    const result = await orderApi.transport(props.orderId);
    if (current === version) rows.value = result;
  } catch (reason) {
    if (current === version)
      error.value =
        reason instanceof Error ? reason.message : "运输轨迹加载失败";
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(() => props.orderId, load, { immediate: true });
</script>

<template>
  <div class="transport-heading">
    <div>
      <h4>容器运输轨迹</h4>
      <p>
        保留各车次与托盘的运输记录，展开查看实际作业时间；中转各段数量不累加，最终目的地卸货才计入完成。
      </p>
    </div>
    <el-button :loading="loading" @click="load">刷新进度</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"
    ><el-button link type="primary" @click="load">重试</el-button></el-alert
  >
  <el-table
    v-else
    v-loading="loading"
    :data="rows"
    empty-text="尚无实提托盘，完成提货后将显示运输记录"
  >
    <el-table-column type="expand"
      ><template #default="{ row }">
        <div class="segment-detail">
          <p>
            承运人：{{ row.carrierName || "尚未指派" }} · 装货节点：{{
              row.loadNodeName || "尚未绑定"
            }}
            · 卸货节点：{{ row.unloadNodeName || "尚未绑定" }}
          </p>
          <ol class="event-list">
            <li
              v-for="column in events"
              :key="column.field"
              :class="{ happened: row[column.field] }"
            >
              <strong>{{ column.label }}</strong
              ><span>{{ formatDateTime(row[column.field]) }}</span>
            </li>
          </ol>
        </div>
      </template></el-table-column
    >
    <el-table-column label="托盘 / 商品" min-width="230"
      ><template #default="{ row }"
        ><strong>{{ row.containerCode }}</strong>
        <div class="secondary">
          {{ row.goodsName }} · {{ row.quantity }} {{ row.unit }}
        </div></template
      ></el-table-column
    >
    <el-table-column label="关联车次" min-width="220"
      ><template #default="{ row }"
        ><el-button
          v-if="row.tripNo"
          link
          type="primary"
          @click="
            router.push({
              path: '/tms/transport',
              query: { tripNo: row.tripNo }
            })
          "
          >{{ row.tripNo }}</el-button
        ><span v-else>尚未绑定车次</span>
        <div class="secondary">
          {{ statuses[row.tripStatus] || "待安排运输" }}
        </div></template
      ></el-table-column
    >
    <el-table-column label="本段运输" min-width="200"
      ><template #default="{ row }"
        ><div>
          {{ row.loadNodeName || "待装货" }} →
          {{ row.unloadNodeName || "待卸货" }}
        </div>
        <el-tag
          size="small"
          :type="row.segmentStatus === 'UNLOADED' ? 'success' : 'info'"
          >{{ segmentStatuses[row.segmentStatus] || "待安排" }}</el-tag
        ></template
      ></el-table-column
    >
    <el-table-column label="本段已卸" width="130"
      ><template #default="{ row }"
        >{{ row.receivedQuantity ?? "—" }} {{ row.unit }}</template
      ></el-table-column
    >
    <el-table-column label="最终交付" width="130"
      ><template #default="{ row }"
        >{{ row.completedQuantity }} {{ row.unit }}</template
      ></el-table-column
    >
  </el-table>
</template>
<style scoped>
.transport-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0 16px;
}

.transport-heading h4 {
  margin: 0 0 8px;
}

.transport-heading p,
.secondary,
.segment-detail p {
  font-size: 12px;
  line-height: 1.7;
  color: var(--tms-muted);
}

.transport-heading p {
  margin: 0;
}

.secondary {
  margin-top: 6px;
}

.segment-detail {
  padding: 18px 24px;
  background: var(--tms-soft);
}

.event-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  padding: 0;
  list-style: none;
}

.event-list li {
  display: grid;
  gap: 6px;
  padding-left: 12px;
  font-size: 12px;
  border-left: 2px solid var(--tms-line);
}

.event-list .happened {
  border-left-color: var(--el-color-success);
}

.event-list span {
  color: var(--tms-muted);
}

@media (width <= 700px) {
  .event-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
