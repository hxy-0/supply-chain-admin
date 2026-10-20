<script setup lang="ts">
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { formatDateTime } from "@/utils/date";
import {
  pickupExecutionApi,
  type PickupContainer
} from "@/api/tmsPickupExecution";
import type { PickupTask } from "@/api/tmsPickup";
import RouteWorkbench from "../dispatch/components/RouteWorkbench.vue";
import { pickupGoodsGroups } from "./presentation";
defineOptions({ name: "TmsPickupDetail" });
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const loadError = ref("");
const task = ref<PickupTask>();
const containers = ref<PickupContainer[]>([]);
const labels: Record<string, string> = {
  PENDING: "待安排",
  ASSIGNED: "已安排",
  PARTIALLY_PICKED: "部分提货",
  FINISHED: "提货结束",
  CANCELLED: "已取消"
};
const groups = computed(() =>
  task.value ? pickupGoodsGroups(task.value, containers.value) : undefined
);
const pickupStop = computed(() => {
  const current = task.value;
  return current?.stops.find(stop => stop.stopId === current.pickupStopId);
});
let detailVersion = 0;
function failure(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function show(id: string) {
  if (id !== route.params.id) return;
  const version = ++detailVersion;
  loading.value = true;
  loadError.value = "";
  try {
    const result = await pickupExecutionApi.detail(id);
    const contents = await pickupExecutionApi.containers(id);
    if (version !== detailVersion) return;
    task.value = result;
    containers.value = contents;
  } catch (reason) {
    if (version === detailVersion) {
      loadError.value =
        reason instanceof Error ? reason.message : "详情加载失败";
      failure(reason);
    }
  } finally {
    if (version === detailVersion) loading.value = false;
  }
}
watch(
  () => route.params.id,
  id => {
    task.value = undefined;
    containers.value = [];
    if (typeof id === "string" && id) void show(id);
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  detailVersion++;
});
</script>
<template>
  <div class="tms-workspace">
    <WorkspaceHeader
      title="提货任务详情"
      description="对照查看计划与实提数量，追踪实体及虚拟托盘及车次节点。"
    >
      <el-button @click="router.push('/tms/pickup')">返回列表</el-button>
      <el-button :disabled="loading" @click="show(String(route.params.id))"
        >刷新</el-button
      >
    </WorkspaceHeader>
    <section v-loading="loading" class="tms-panel">
      <el-result
        v-if="loadError"
        icon="error"
        title="详情加载失败"
        :sub-title="loadError"
      >
        <template #extra
          ><el-button @click="show(String(route.params.id))"
            >重试</el-button
          ></template
        >
      </el-result>
      <template v-if="task && groups">
        <h2 class="section-title">基础信息</h2>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="提货任务号">{{
            task.taskNo
          }}</el-descriptions-item>
          <el-descriptions-item label="车次号">{{
            task.tripNo || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="状态"
            ><el-tag>{{ labels[task.status] }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="运输组织方式">{{
            task.transportOrganizationType === "DIRECT"
              ? "直达运输"
              : "中转运输"
          }}</el-descriptions-item>
          <el-descriptions-item label="提货地址" :span="2">{{
            task.pickupAddress
          }}</el-descriptions-item>
          <el-descriptions-item label="联系人" :span="2">{{
            task.contacts
              .map(contact => `${contact.name} ${contact.phone}`)
              .join("；")
          }}</el-descriptions-item>
          <el-descriptions-item label="计划到达">{{
            formatDateTime(pickupStop?.plannedArrivalTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="实际到达">{{
            formatDateTime(pickupStop?.arrivedTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="计划发车">{{
            formatDateTime(pickupStop?.plannedDepartureTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="实际发车">{{
            formatDateTime(pickupStop?.departedTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="关联订单"
            >{{ groups.orders.length }} 单</el-descriptions-item
          >
          <el-descriptions-item label="实际装载"
            >{{ groups.containerCount }} 个装载单元（含
            {{ groups.virtualCount }} 个虚拟托盘）</el-descriptions-item
          >
        </el-descriptions>
        <h2 class="section-title">提货明细（计划 / 实际）</h2>
        <div
          v-for="order in groups.orders"
          :key="order.orderId"
          class="goods-group"
        >
          <h3>订单 {{ order.orderNo }}</h3>
          <el-table :data="order.planned" border>
            <el-table-column type="expand">
              <template #default="{ row }">
                <el-table
                  :data="row.allocations"
                  border
                  empty-text="此商品尚未实提"
                >
                  <el-table-column prop="containerType" label="装载方式" />
                  <el-table-column
                    prop="containerCode"
                    label="托盘 / 容器号"
                    min-width="240"
                  />
                  <el-table-column prop="quantity" label="本批实提量" />
                  <el-table-column prop="unit" label="单位" />
                  <el-table-column label="实提时间" min-width="170"
                    ><template #default="{ row: allocation }">{{
                      formatDateTime(allocation.pickedTime)
                    }}</template></el-table-column
                  >
                </el-table>
              </template>
            </el-table-column>
            <el-table-column prop="goodsName" label="商品" min-width="160" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column prop="plannedQuantity" label="计划提货量" />
            <el-table-column prop="pickedQuantity" label="实际提货量" />
            <el-table-column prop="remainingQuantity" label="未提量" />
            <el-table-column prop="shortageQuantity" label="已确认少备量" />
            <el-table-column
              prop="shortageReason"
              label="少备原因"
              min-width="130"
            />
            <el-table-column label="实提分配" min-width="230"
              ><template #default="{ row }">
                <div
                  v-for="allocation in row.allocations"
                  :key="allocation.containerItemId"
                >
                  {{ allocation.containerType }} ·
                  {{ allocation.containerCode }}：{{ allocation.quantity }}
                  {{ allocation.unit }}
                </div>
                <span v-if="!row.allocations.length">尚未实提</span>
              </template></el-table-column
            >
          </el-table>
        </div>
        <el-collapse class="mt-6"
          ><el-collapse-item title="车次节点与到发时间" name="route"
            ><RouteWorkbench :tasks="[task]" /></el-collapse-item
        ></el-collapse>
      </template>
    </section>
  </div>
</template>

<style scoped>
.section-title {
  padding-left: 12px;
  margin: 24px 0 20px;
  font-size: 17px;
  font-weight: 600;
  border-left: 4px solid var(--el-color-primary);
}

.section-title:first-child {
  margin-top: 0;
}

.goods-group {
  margin-bottom: 20px;
}

.goods-group h3 {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.goods-group p {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
}
</style>
