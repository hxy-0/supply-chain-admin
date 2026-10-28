<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import Sortable from "sortablejs";
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import { shiftApi, type Shift, type ShiftNode } from "@/api/tmsShift";
import { dispatchApi } from "@/api/tmsDispatch";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import { hasPerms } from "@/utils/auth";
import PlanPanel from "./components/PlanPanel.vue";
import {
  rangeDays,
  validateStops,
  slotLabel,
  shiftStartArrive,
  slotShifts
} from "./week";
defineOptions({ name: "TmsDispatch" });
const router = useRouter();
const anchor = ref(dayjs().format("YYYY-MM-DD"));
const days = computed(() => rangeDays(anchor.value));
const rows = ref<Shift[]>([]),
  loading = ref(false),
  generating = ref(false);
const detailOpen = ref(false),
  detailLoading = ref(false),
  saving = ref(false);
const form = ref<Shift>();
const nodes = ref<LogisticNode[]>([]);
const nodeTableRef = ref();
/** 本会话已为班次创建过调度计划的 shiftId：按钮退化为仅保存 */
const plannedShifts = new Set<string>();
let keySeed = 0;
const editable = computed(
  () => form.value?.status === 10 && hasPerms("tms:dispatch:create")
);
/** 网格行：六个时段，每格预计算该天该时段的班次列表 */
const slotRows = computed(() =>
  [0, 1, 2, 3, 4, 5].map(slot => ({
    label: slotLabel(slot),
    cells: days.value.map(day => ({
      date: day.date,
      label: day.label,
      shifts: slotShifts(rows.value, day.date, slot)
    }))
  }))
);
let version = 0,
  detailVersion = 0;
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function load() {
  const current = ++version;
  loading.value = true;
  try {
    const result = await shiftApi.week(anchor.value);
    if (current === version) rows.value = result;
  } catch (reason) {
    if (current === version) {
      rows.value = [];
      error(reason);
    }
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(anchor, () => void load(), { immediate: true });
onUnmounted(() => {
  version++;
  detailVersion++;
});
function moveRange(delta: number) {
  anchor.value = dayjs(anchor.value).add(delta, "day").format("YYYY-MM-DD");
}
function hhmm(value?: number) {
  const time = Number(value);
  return Number.isFinite(time) && time > 0 ? dayjs(time).format("HH:mm") : "—";
}
async function generate() {
  generating.value = true;
  try {
    const ids = await shiftApi.generateWeek(anchor.value);
    ElMessage.success(
      ids.length
        ? `七天规则匹配 ${ids.length} 个班次，已有班次保留`
        : "这七天没有符合规则的班次日期"
    );
    await load();
  } catch (reason) {
    error(reason);
  } finally {
    generating.value = false;
  }
}
async function searchNodes(name = "") {
  const result = await logisticNodeApi.page({
    name,
    pageNum: 1,
    pageSize: 100
  });
  nodes.value = [
    ...new Map(
      [...nodes.value, ...result.records].map(node => [node.id, node])
    ).values()
  ];
}
async function remoteNodes(name: string) {
  try {
    await searchNodes(name);
  } catch (reason) {
    error(reason);
  }
}
async function detail(id: string) {
  const current = ++detailVersion;
  form.value = undefined;
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const [record] = await Promise.all([shiftApi.detail(id), searchNodes()]);
    if (current === detailVersion && detailOpen.value) {
      form.value = {
        ...record,
        nodes: record.nodes.map(node => ({
          ...node,
          _key: node._key ?? nextKey()
        }))
      };
      await nextTick();
      initRowDrag();
    }
  } catch (reason) {
    error(reason);
  } finally {
    if (current === detailVersion) detailLoading.value = false;
  }
}
function nextKey() {
  keySeed += 1;
  return `node-${keySeed}-${Math.random().toString(36).slice(2, 8)}`;
}
function initRowDrag() {
  const table = nodeTableRef.value?.$el as HTMLElement | undefined;
  const tbody = table?.querySelector(".el-table__body tbody");
  if (!tbody) return;
  Sortable.create(tbody as HTMLElement, {
    handle: ".drag-handle",
    animation: 200,
    onEnd: ({ oldIndex, newIndex }) => {
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      )
        return;
      const list = form.value!.nodes;
      const [moved] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, moved);
    }
  });
}
/** 新增经停点：插入到终点之前，时刻沿用前一站发车时间 */
function addStop() {
  const list = form.value!.nodes;
  const before = list[list.length - 2] ?? list[0];
  list.splice(list.length - 1, 0, {
    _key: nextKey(),
    nodeId: "",
    nodeName: undefined,
    planArriveTime: before.planDepartTime,
    planDepartTime: before.planDepartTime
  });
}
function removeStop(index: number) {
  form.value!.nodes.splice(index, 1);
}
function nodeChanged(node: ShiftNode) {
  node.nodeName = nodes.value.find(item => item.id === node.nodeId)?.name;
}
/** 保存节点编辑，并为尚未创建调度计划的班次连带创建（合二为一） */
async function save() {
  if (!form.value || !editable.value) return;
  const problem = validateStops(form.value.nodes);
  if (problem) return ElMessage.warning(problem);
  saving.value = true;
  try {
    await shiftApi.save({
      ...form.value,
      nodes: form.value.nodes.map(node => ({
        ...node,
        planArriveTime: Number(node.planArriveTime),
        planDepartTime:
          node.planDepartTime == null || node.planDepartTime === ""
            ? null
            : Number(node.planDepartTime)
      }))
    });
    let planNo: string | null = null;
    if (!plannedShifts.has(form.value.shiftId)) {
      const plan = await dispatchApi.create({ shiftId: form.value.shiftId });
      plannedShifts.add(form.value.shiftId);
      planNo = plan.planNo;
    }
    ElMessage.success(
      planNo
        ? `班次已保存，调度计划 ${planNo} 已创建（草稿）`
        : "班次节点与到发时间已保存"
    );
    detailOpen.value = false;
    await load();
  } catch (reason) {
    error(reason);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <div class="tms-workspace">
    <WorkspaceHeader
      title="班次计划"
      description="由线路及生成规则安排每天的班次，按起点到达时段查看七天排班。"
    >
      <el-button
        v-if="hasPerms('tms:dispatch:view')"
        @click="router.push('/tms/shift-template')"
        >线路班次配置</el-button
      >
    </WorkspaceHeader>
    <section class="tms-panel">
      <div class="week-toolbar">
        <div class="week-navigation">
          <el-button @click="moveRange(-7)">前七天</el-button>
          <el-date-picker
            v-model="anchor"
            type="date"
            :clearable="false"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            placeholder="选择起始日期"
            aria-label="选择排班起始日期"
          />
          <el-button @click="moveRange(7)">后七天</el-button>
          <el-button @click="anchor = dayjs().format('YYYY-MM-DD')"
            >今天</el-button
          >
        </div>
        <div>
          <el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>
      <p class="week-summary">
        {{ days[0].date }}（{{ days[0].label }}）起七天 · 共 {{ rows.length }}
        个班次 · 每天按起点到达时刻分成 0:00-4:00、4:00-8:00、…、20:00-24:00
        六个时段
      </p>
      <div v-loading="loading" class="week-grid">
        <div class="grid-head grid-corner">时段 \ 日期</div>
        <div v-for="day in days" :key="day.date" class="grid-head">
          <strong>{{ day.label }}</strong
          ><span>{{ day.date }}</span>
        </div>
        <template v-for="row in slotRows" :key="row.label">
          <div class="grid-line">{{ row.label }}</div>
          <div
            v-for="cell in row.cells"
            :key="row.label + cell.date"
            class="grid-cell"
            :class="{ filled: cell.shifts.length }"
          >
            <button
              v-for="shift in cell.shifts"
              :key="shift.shiftId"
              class="shift-card"
              :class="{ cancelled: shift.status === 99 }"
              type="button"
              @click="detail(shift.shiftId)"
            >
              <strong>{{ shift.fromNodeName || "—" }}</strong>
              <span class="shift-route">{{
                shift.shiftName || shift.templateNo || shift.shiftNo
              }}</span>
              <span
                >到达 {{ hhmm(shiftStartArrive(shift) ?? undefined) }} · 发车
                {{ hhmm(shift.planDepartTime) }}</span
              >
              <span class="shift-state">{{
                shift.statusDescription ||
                (shift.status === 10 ? "已计划" : "已取消")
              }}</span>
            </button>
            <span v-if="!cell.shifts.length" class="slot-empty">—</span>
          </div>
        </template>
        <div v-if="!rows.length" class="grid-empty">
          这七天暂无班次，请先配置线路及规则，再点击按规则生成七天。
        </div>
      </div>
    </section>
    <PlanPanel />
    <BusinessDialog
      v-model="detailOpen"
      title="班次详情"
      width="1200px"
      :busy="saving || detailLoading"
      @submit="save"
    >
      <div v-if="form" v-loading="detailLoading">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="班次号">{{
            form.shiftNo
          }}</el-descriptions-item
          ><el-descriptions-item label="来源配置">{{
            form.templateNo || "手工班次"
          }}</el-descriptions-item
          ><el-descriptions-item label="状态">{{
            form.statusDescription || "已计划"
          }}</el-descriptions-item>
        </el-descriptions>
        <div class="flex-bc mt-4 mb-3">
          <strong>线路节点</strong>
          <el-button v-if="editable" :disabled="saving" @click="addStop"
            >添加经停点</el-button
          >
        </div>
        <el-form :disabled="!editable || saving" label-width="90px">
          <el-form-item label="班次名称"
            ><el-input v-model="form.shiftName" maxlength="100"
          /></el-form-item>
          <el-table ref="nodeTableRef" :data="form.nodes" border row-key="_key">
            <el-table-column width="44" align="center"
              ><template #default
                ><span class="drag-handle" title="拖动调整顺序"
                  >⠿</span
                ></template
              ></el-table-column
            >
            <el-table-column label="物流节点" min-width="220"
              ><template #default="{ row, $index }"
                ><small class="week-muted">{{
                  $index === 0
                    ? "始发点"
                    : $index === form.nodes.length - 1
                      ? "终点"
                      : "经停点"
                }}</small
                ><el-select
                  v-model="row.nodeId"
                  filterable
                  remote
                  :remote-method="remoteNodes"
                  @change="nodeChanged(row as ShiftNode)"
                  ><el-option
                    v-for="node in nodes"
                    :key="node.id"
                    :value="node.id"
                    :label="node.name" /><el-option
                    v-if="
                      row.nodeId && !nodes.some(node => node.id === row.nodeId)
                    "
                    :value="row.nodeId"
                    :label="row.nodeName || row.nodeId" /></el-select></template
            ></el-table-column>
            <el-table-column label="计划到达时间" min-width="230"
              ><template #default="{ row }"
                ><el-date-picker
                  v-model="row.planArriveTime"
                  type="datetime"
                  value-format="x"
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="计划到达" /></template
            ></el-table-column>
            <el-table-column label="计划发车时间" min-width="230"
              ><template #default="{ row, $index }"
                ><el-date-picker
                  v-model="row.planDepartTime"
                  type="datetime"
                  value-format="x"
                  format="YYYY-MM-DD HH:mm:ss"
                  :placeholder="
                    $index === form.nodes.length - 1 ? '可不填' : '计划发车'
                  " /></template
            ></el-table-column>
            <el-table-column
              v-if="editable"
              label="操作"
              width="72"
              align="center"
              ><template #default="{ $index }"
                ><button
                  v-if="$index > 0 && $index < form.nodes.length - 1"
                  class="stop-remove"
                  type="button"
                  title="删除该经停点"
                  @click="removeStop($index)"
                >
                  −
                </button></template
              ></el-table-column
            >
          </el-table>
          <el-form-item label="备注" class="mt-4"
            ><el-input v-model="form.remark" maxlength="255"
          /></el-form-item>
        </el-form>
        <p class="week-muted">
          保存本班次即创建对应的调度计划（每班次一次）；节点顺序可拖动 ⠿
          调整。已有运输车次的班次由后台拒绝改动。
        </p>
      </div>
      <template #footer
        ><el-button :disabled="saving" @click="detailOpen = false"
          >关闭</el-button
        ><el-button
          v-if="editable"
          type="primary"
          :loading="saving"
          :disabled="detailLoading"
          @click="save"
          >{{
            form && plannedShifts.has(form.shiftId) ? "保存" : "创建调度计划"
          }}</el-button
        ></template
      >
    </BusinessDialog>
  </div>
</template>
<style scoped>
.week-toolbar,
.week-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.week-toolbar {
  justify-content: space-between;
}

.week-summary {
  margin: 20px 0;
  font-size: 13px;
  color: var(--tms-muted);
}

.week-muted {
  font-size: 12px;
  color: var(--tms-muted);
}

.week-grid {
  display: grid;
  grid-template-columns: 90px repeat(7, minmax(128px, 1fr));
  grid-auto-rows: minmax(72px, auto);
  gap: 1px;
  min-width: 1040px;
  overflow: hidden;
  background: var(--tms-line);
  border: 1px solid var(--tms-line);
  border-radius: 8px;
}

.grid-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  text-align: center;
  background: var(--el-color-primary-light-9);
}

.grid-head strong {
  font-size: 13px;
}

.grid-head span {
  font-size: 11px;
  color: var(--tms-muted);
}

.grid-corner {
  justify-content: center;
  font-size: 12px;
  color: var(--tms-muted);
}

.grid-line {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tms-ink);
  background: var(--el-bg-color);
}

.grid-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  background: var(--el-bg-color);
}

.slot-empty {
  font-size: 11px;
  color: var(--tms-muted);
  opacity: 0.55;
}

.shift-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 8px 9px;
  text-align: left;
  cursor: pointer;
  background: var(--tms-soft);
  border: 1px solid var(--tms-line);
  border-left: 3px solid var(--tms-accent);
  border-radius: 6px;
}

.shift-card strong {
  font-size: 12px;
  color: var(--tms-ink);
  overflow-wrap: anywhere;
}

.shift-card span {
  font-size: 11px;
  color: var(--tms-muted);
}

.shift-card .shift-route {
  overflow-wrap: anywhere;
}

.shift-card .shift-state {
  color: var(--tms-accent);
}

.shift-card.cancelled {
  border-left-color: var(--tms-muted);
  opacity: 0.6;
}

.shift-card:hover,
.shift-card:focus-visible {
  outline: 2px solid var(--tms-accent);
  outline-offset: 1px;
}

.grid-empty {
  grid-column: 1 / -1;
  padding: 32px;
  font-size: 13px;
  color: var(--tms-muted);
  text-align: center;
  background: var(--el-bg-color);
}

.drag-handle {
  font-size: 14px;
  color: var(--tms-muted);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.stop-remove {
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  color: var(--tms-muted);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--tms-line);
  border-radius: 50%;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.stop-remove:hover {
  color: #fff;
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
}

.plan-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}
</style>
