<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import { hasPerms } from "@/utils/auth";
import { formatDateTime } from "@/utils/date";
import {
  dispatchApi,
  type DispatchPlan,
  type DispatchTrip
} from "@/api/tmsDispatch";
import type { PickupContainer } from "@/api/tmsPickupExecution";

defineOptions({ name: "TmsDispatchPlanPanel" });

const emits = defineEmits<{ (e: "changed"): void }>();

const planLabels: Record<string, string> = {
  DRAFT: "草稿",
  ISSUED: "已下发",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const tripLabels: Record<string, string> = {
  PENDING_ASSIGNMENT: "待指派",
  PENDING_EXECUTION: "待执行",
  WAITING_DEPARTURE: "待发车",
  IN_TRANSIT: "运输中",
  DELIVERED: "已送达",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};

const rows = ref<DispatchPlan[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const busy = ref(false);
const planNo = ref("");
const status = ref("");
const manageOpen = ref(false);
const manageLoading = ref(false);
const plan = ref<DispatchPlan>();
const available = ref<PickupContainer[]>([]);
const pickedContainers = ref<string[]>([]);
const targetTripId = ref("");

const canManage = computed(
  () => hasPerms("tms:dispatch:create") || hasPerms("tms:dispatch:cancel")
);
const draft = computed(() => plan.value?.status === "DRAFT");
const trips = computed<DispatchTrip[]>(() => plan.value?.trips ?? []);

async function load() {
  loading.value = true;
  try {
    const result = await dispatchApi.page({
      planNo: planNo.value || undefined,
      status: status.value || undefined,
      pageNum: page.value,
      pageSize: 20
    });
    rows.value = result.records;
    total.value = Number(result.total ?? 0);
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function openManage(row: DispatchPlan) {
  manageOpen.value = true;
  manageLoading.value = true;
  plan.value = undefined;
  available.value = [];
  pickedContainers.value = [];
  try {
    plan.value = await dispatchApi.detail(row.planId);
    if (draft.value) {
      available.value = await dispatchApi.available(row.planId);
    }
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : "加载失败");
  } finally {
    manageLoading.value = false;
  }
}

async function refreshPlan() {
  if (!plan.value) return;
  manageLoading.value = true;
  try {
    const current = plan.value.planId;
    plan.value = await dispatchApi.detail(current);
    available.value = draft.value ? await dispatchApi.available(current) : [];
    pickedContainers.value = [];
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : "加载失败");
  } finally {
    manageLoading.value = false;
  }
}

function failure(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}

async function run(action: () => Promise<unknown>, message: string) {
  busy.value = true;
  try {
    await action();
    ElMessage.success(message);
    await refreshPlan();
    emits("changed");
  } catch (reason) {
    failure(reason);
  } finally {
    busy.value = false;
  }
}

function addTrip() {
  if (!plan.value) return;
  void run(() => dispatchApi.addTrip(plan.value!.planId), "已添加车次");
}

function cancelTrip(row: DispatchTrip) {
  if (!plan.value) return;
  ElMessageBox.confirm(
    `取消车次 ${row.tripNo} 并释放其容器预留？`,
    "取消车次",
    { type: "warning" }
  ).then(() => {
    void run(
      () => dispatchApi.cancelTrip(plan.value!.planId, row.tripId),
      "车次已取消"
    );
  });
}

function cargo() {
  if (!plan.value || !targetTripId.value) {
    ElMessage.warning("请选择目标车次");
    return;
  }
  if (!pickedContainers.value.length) {
    ElMessage.warning("请选择要装入的容器");
    return;
  }
  void run(
    () =>
      dispatchApi.cargo(
        plan.value!.planId,
        targetTripId.value,
        pickedContainers.value
      ),
    "容器已加入车次"
  );
}

function issue() {
  if (!plan.value) return;
  ElMessageBox.confirm(
    "下发后承运人按车次派车执行，容器清单锁定不能再追加？",
    "下发班次计划",
    { type: "warning" }
  ).then(() => {
    void run(() => dispatchApi.issue(plan.value!.planId), "计划已下发");
  });
}

function cancelPlan() {
  if (!plan.value) return;
  ElMessageBox.confirm("取消整个班次计划并释放全部容器预留？", "取消计划", {
    type: "warning"
  }).then(() => {
    void run(() => dispatchApi.cancel(plan.value!.planId), "计划已取消");
  });
}

onMounted(() => void load());
</script>

<template>
  <section class="tms-panel">
    <div class="panel-toolbar">
      <div class="panel-filters">
        <el-input
          v-model="planNo"
          placeholder="计划号"
          clearable
          class="plan-filter"
          @keyup.enter="
            page = 1;
            load();
          "
        />
        <el-select
          v-model="status"
          placeholder="计划状态"
          clearable
          class="plan-filter"
          @change="
            page = 1;
            load();
          "
        >
          <el-option
            v-for="(label, key) in planLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-button
          @click="
            page = 1;
            load();
          "
          >查询</el-button
        >
      </div>
      <p class="panel-tip">
        一份计划对应一个班次；采集容器后可添加车次手动拆分，每车按容器目的地绑定卸货点。
      </p>
    </div>
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="planNo" label="计划号" min-width="150" />
      <el-table-column label="班次线路" min-width="200"
        ><template #default="{ row }"
          >{{ row.originNodeName || "—" }}→{{
            row.destinationNodeName || "—"
          }}</template
        ></el-table-column
      >
      <el-table-column label="计划发车" width="180"
        ><template #default="{ row }">{{
          formatDateTime(row.plannedDepartureTime)
        }}</template></el-table-column
      >
      <el-table-column label="车次" width="90"
        ><template #default="{ row }">{{
          row.trips?.length ?? 0
        }}</template></el-table-column
      >
      <el-table-column label="容器" width="90"
        ><template #default="{ row }">{{
          row.containers?.length ?? 0
        }}</template></el-table-column
      >
      <el-table-column label="状态" width="110"
        ><template #default="{ row }">{{
          planLabels[row.status] ?? row.status
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="100" fixed="right"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            @click="openManage(row as DispatchPlan)"
            >管理</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="20"
      layout="total, prev, pager, next"
      class="mt-3"
      @current-change="load"
    />

    <BusinessDialog
      v-model="manageOpen"
      :title="plan ? `调度计划 ${plan.planNo}` : '调度计划'"
      width="1100px"
      :busy="busy || manageLoading"
      readonly
    >
      <div v-if="plan" v-loading="manageLoading">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="班次">{{
            plan.shiftName || plan.shiftNo
          }}</el-descriptions-item>
          <el-descriptions-item label="线路"
            >{{ plan.originNodeName }} →
            {{ plan.destinationNodeName }}</el-descriptions-item
          >
          <el-descriptions-item label="计划发车">{{
            formatDateTime(plan.plannedDepartureTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{
            planLabels[plan.status]
          }}</el-descriptions-item>
        </el-descriptions>

        <div class="flex-bc mt-4 mb-2">
          <strong>计划车次</strong>
          <el-button
            v-if="draft && hasPerms('tms:dispatch:create')"
            :disabled="busy"
            @click="addTrip"
            >添加车次</el-button
          >
        </div>
        <el-table :data="trips" border>
          <el-table-column prop="tripNo" label="车次号" min-width="150" />
          <el-table-column label="状态" width="110"
            ><template #default="{ row }">{{
              tripLabels[row.status] ?? row.status
            }}</template></el-table-column
          >
          <el-table-column label="容器数" width="90"
            ><template #default="{ row }">{{
              row.containerCount
            }}</template></el-table-column
          >
          <el-table-column v-if="draft && canManage" label="操作" width="120"
            ><template #default="{ row }"
              ><el-button
                link
                type="danger"
                :disabled="busy || row.containerCount === 0"
                @click="cancelTrip(row as DispatchTrip)"
                >取消车次</el-button
              ></template
            ></el-table-column
          >
        </el-table>

        <template v-if="draft">
          <div class="flex-bc mt-4 mb-2">
            <strong>始发仓可用容器</strong>
            <span class="panel-tip"
              >按容器最终目的地匹配线路上的卸货点；目的地不在本线路的容器不能装入</span
            >
          </div>
          <div class="cargo-target mb-2">
            <span>装入车次</span>
            <el-select
              v-model="targetTripId"
              placeholder="选择车次"
              class="trip-select"
            >
              <el-option
                v-for="trip in trips"
                :key="trip.tripId"
                :value="trip.tripId"
                :label="trip.tripNo"
              />
            </el-select>
            <el-button
              v-if="hasPerms('tms:dispatch:create')"
              type="primary"
              :disabled="busy"
              @click="cargo"
              >加入车次</el-button
            >
          </div>
          <el-table
            :data="available"
            border
            empty-text="始发仓暂无就绪待运容器"
            @selection-change="
              (picked: PickupContainer[]) =>
                (pickedContainers = picked.map(row => row.containerId))
            "
          >
            <el-table-column type="selection" width="44" />
            <el-table-column
              prop="containerCode"
              label="容器码"
              min-width="140"
            />
            <el-table-column prop="containerType" label="类型" width="100" />
            <el-table-column label="商品" min-width="220"
              ><template #default="{ row }"
                >{{ row.items?.length ?? 0 }} 项 ·
                {{
                  row.items
                    ?.map(
                      (item: PickupContainer["items"][number]) => item.goodsName
                    )
                    .join("、")
                }}</template
              ></el-table-column
            >
          </el-table>
        </template>

        <div class="flex-bc mt-4 mb-2">
          <strong>已加入计划的容器</strong>
        </div>
        <el-table :data="plan.containers" border empty-text="尚未加入容器">
          <el-table-column
            prop="containerCode"
            label="容器码"
            min-width="140"
          />
          <el-table-column label="商品" min-width="240"
            ><template #default="{ row }"
              >{{ row.items?.length ?? 0 }} 项 ·
              {{
                row.items
                  ?.map(
                    (item: PickupContainer["items"][number]) => item.goodsName
                  )
                  .join("、")
              }}</template
            ></el-table-column
          >
        </el-table>

        <div v-if="draft && canManage" class="plan-actions">
          <el-button
            v-if="hasPerms('tms:dispatch:create')"
            type="primary"
            :loading="busy"
            :disabled="manageLoading"
            @click="issue"
            >下发计划</el-button
          >
          <el-button
            v-if="hasPerms('tms:dispatch:cancel')"
            type="danger"
            plain
            :loading="busy"
            :disabled="manageLoading"
            @click="cancelPlan"
            >取消计划</el-button
          >
        </div>
      </div>
      <template #footer
        ><el-button :disabled="busy" @click="manageOpen = false"
          >关闭</el-button
        ></template
      >
    </BusinessDialog>
  </section>
</template>

<style scoped>
.panel-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.panel-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.plan-filter {
  width: 200px;
}

.panel-tip {
  margin: 0;
  font-size: 12px;
  color: var(--tms-muted);
}

.cargo-target {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
}

.trip-select {
  width: 240px;
}

.plan-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
</style>
