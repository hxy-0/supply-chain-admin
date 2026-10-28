<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import Sortable from "sortablejs";
import { useRouter } from "vue-router";
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import {
  shiftApi,
  type ShiftTemplate,
  type TemplateNode,
  type ShiftRule
} from "@/api/tmsShift";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import { hasPerms } from "@/utils/auth";
const router = useRouter();
const rows = ref<ShiftTemplate[]>([]),
  total = ref(0),
  page = ref(1),
  loading = ref(false);
const open = ref(false),
  busy = ref(false),
  openingNew = ref(false),
  openingId = ref<string | null>(null),
  nodes = ref<LogisticNode[]>([]);
const nodeTableRef = ref();
let keySeed = 0;
const form = ref<ShiftTemplate>(empty());

/** 规则卡片生成器的界面状态；下划线字段保存前剔除 */
type RuleUi = ShiftRule & {
  _key?: string;
  _weekdays?: string[];
};
const WEEK_DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEK_CN: Record<string, string> = {
  MON: "一",
  TUE: "二",
  WED: "三",
  THU: "四",
  FRI: "五",
  SAT: "六",
  SUN: "日"
};

function empty(): ShiftTemplate {
  return {
    templateNo: "",
    templateName: "",
    isEnable: true,
    nodes: [
      { _key: nextKey(), nodeId: "", arriveTime: "08:00", departTime: "08:00" },
      { _key: nextKey(), nodeId: "", arriveTime: "12:00", departTime: "12:00" }
    ],
    genRules: [emptyRule()]
  };
}
function nextKey() {
  keySeed += 1;
  return `row-${keySeed}-${Math.random().toString(36).slice(2, 8)}`;
}
function emptyRule(): RuleUi {
  return {
    _key: nextKey(),
    cronExpr: "0 0 0 * * MON",
    advanceDays: "0",
    isEnable: true,
    _weekdays: ["MON"]
  };
}
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function load() {
  loading.value = true;
  try {
    const result = await shiftApi.templates({
      pageNum: page.value,
      pageSize: 10
    });
    rows.value = result.records;
    total.value = result.total;
  } catch (reason) {
    error(reason);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
async function searchNodes(name = "") {
  try {
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
  } catch (reason) {
    error(reason);
  }
}
async function edit(record?: ShiftTemplate) {
  // 打开弹窗的加载态只反馈到被点击的按钮上，不占用保存用的 busy
  const templateId = record?.templateId;
  const isNew = !templateId;
  if (isNew) openingNew.value = true;
  else openingId.value = templateId!;
  try {
    const source = templateId ? await shiftApi.template(templateId) : empty();
    form.value = {
      ...source,
      nodes: source.nodes.map(node => ({
        ...node,
        _key: node._key ?? nextKey()
      })),
      genRules: source.genRules.map(rule => ({
        ...emptyRule(),
        ...rule,
        ...cronToState(rule.cronExpr)
      }))
    };
    await searchNodes();
    open.value = true;
    await nextTick();
    initRowDrag();
  } catch (reason) {
    error(reason);
  } finally {
    if (isNew) openingNew.value = false;
    else openingId.value = null;
  }
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
      const list = form.value.nodes;
      const [moved] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, moved);
    }
  });
}
watch(open, value => {
  if (value) nextTick(initRowDrag);
});
function changed(node: TemplateNode) {
  node.nodeName = nodes.value.find(item => item.id === node.nodeId)?.name;
}
/** 新增经停点：插入到终点之前，时刻沿用前一站离开时刻。 */
function addStop() {
  const stops = form.value.nodes;
  const before = stops[stops.length - 2] ?? stops[0];
  const inherit = before.departTime || before.arriveTime || "08:00";
  stops.splice(stops.length - 1, 0, {
    _key: nextKey(),
    nodeId: "",
    arriveTime: inherit,
    departTime: inherit
  });
}
function removeStop(index: number) {
  form.value.nodes.splice(index, 1);
}
function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
}
/**
 * 每站到达/发车相对班次日期的天数偏移（D+0/D+1…）：
 * 后站时刻早于前站发车时顺延次日；同行内发车晚于到达由保存校验保证，偏移与到达一致。
 */
function dayOffsets() {
  let previous = -1;
  return form.value.nodes.map(node => {
    const arriveMin = toMinutes(node.arriveTime);
    let arriveOffset = 0;
    if (previous >= 0 && arriveMin !== null) {
      arriveOffset = Math.max(0, Math.ceil((previous - arriveMin) / 1440));
    }
    const departMin = toMinutes(node.departTime);
    const absolute =
      departMin === null
        ? arriveOffset * 1440 + (arriveMin ?? 0)
        : arriveOffset * 1440 + departMin;
    previous = absolute;
    return { arrive: arriveOffset, depart: arriveOffset };
  });
}

/** 依据选中的星期组装六位 Cron：由后端定时任务每日扫描，触发时刻固定为 00:00（仅日期参与判定） */
function syncWeekdays(rule: RuleUi) {
  const days = rule._weekdays ?? [];
  rule.cronExpr = `0 0 0 * * ${days.length ? days.join(",") : "MON"}`;
}
/** Cron → 星期状态；展开 MON-FRI 区间，无法识别时回退全周（保存时以界面选择覆盖） */
function cronToState(cron: string): Partial<RuleUi> {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 6) return { _weekdays: [...WEEK_DOW] };
  const dayOfWeek = parts[5];
  if (dayOfWeek === "*") return { _weekdays: [...WEEK_DOW] };
  const days = new Set<string>();
  for (const token of dayOfWeek.split(",")) {
    const range = token.match(/^([A-Z]{3})-([A-Z]{3})$/);
    if (range) {
      const from = WEEK_DOW.indexOf(range[1]);
      const to = WEEK_DOW.indexOf(range[2]);
      if (from >= 0 && to >= 0) {
        for (let index = from; ; index = (index + 1) % 7) {
          days.add(WEEK_DOW[index]);
          if (index === to) break;
        }
        continue;
      }
    }
    if (WEEK_DOW.includes(token)) days.add(token);
  }
  return { _weekdays: days.size ? [...days] : [...WEEK_DOW] };
}
function stripRule(rule: RuleUi): ShiftRule {
  const { _key, _weekdays, ...rest } = rule;
  return rest;
}

async function save() {
  if (
    !form.value.templateNo.trim() ||
    form.value.nodes.length < 2 ||
    form.value.nodes.some(node => !node.nodeId || !node.arriveTime)
  )
    return ElMessage.warning("请填写配置编号及完整的节点到达时刻");
  const last = form.value.nodes.length - 1;
  for (let index = 0; index < form.value.nodes.length; index++) {
    const node = form.value.nodes[index];
    if (index < last && !node.departTime)
      return ElMessage.warning(
        `第 ${index + 1} 站发车时刻不能为空，仅终点可不填`
      );
    if (node.departTime && node.departTime < node.arriveTime)
      return ElMessage.warning(`第 ${index + 1} 站到达时刻必须早于发车时刻`);
  }
  for (const rule of form.value.genRules as RuleUi[]) syncWeekdays(rule);
  for (let index = 0; index < form.value.genRules.length; index++) {
    const rule = form.value.genRules[index] as RuleUi;
    if (!(rule._weekdays ?? []).length)
      return ElMessage.warning(`第 ${index + 1} 条规则请选择触发星期`);
    if (!rule.advanceDays || !rule.advanceDays.trim())
      return ElMessage.warning(`第 ${index + 1} 条规则缺少提前天数`);
    if (!rule.effectiveStartDate)
      return ElMessage.warning(
        `第 ${index + 1} 条规则请选择生效开始日期；结束不填表示长期有效`
      );
  }
  busy.value = true;
  try {
    await shiftApi.saveTemplate({
      ...form.value,
      genRules: form.value.genRules.map(rule => stripRule(rule as RuleUi))
    });
    ElMessage.success("线路班次配置已保存");
    open.value = false;
    await load();
  } catch (reason) {
    error(reason);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="tms-workspace">
    <WorkspaceHeader
      title="线路班次配置"
      description="配置始发、经停和终点的每日时刻，并设置生成具体日期班次的规则。"
      ><el-button @click="router.push('/tms/dispatch')"
        >查看班次计划</el-button
      ></WorkspaceHeader
    >
    <section class="tms-panel">
      <div class="flex-bc mb-4">
        <h2>线路与生成规则</h2>
        <el-button
          v-if="hasPerms('tms:dispatch:create')"
          type="primary"
          :loading="openingNew"
          @click="edit()"
          >新增线路</el-button
        >
      </div>
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column
          prop="templateNo"
          label="配置编号"
          min-width="180"
        /><el-table-column
          prop="templateName"
          label="线路班次名称"
          min-width="240"
        />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnable ? 'success' : 'info'">{{
              row.isEnable ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="130"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :loading="openingId === row.templateId"
              @click="edit(row as ShiftTemplate)"
              >{{
                hasPerms("tms:dispatch:create") ? "配置详情" : "查看"
              }}</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        class="mt-4"
        :total="total"
        :page-size="10"
        layout="total,prev,pager,next"
        @current-change="load"
      />
    </section>
    <BusinessDialog
      v-model="open"
      title="线路班次配置详情"
      width="1100px"
      :busy="busy"
      @submit="save"
    >
      <el-form
        label-width="100px"
        :disabled="busy || !hasPerms('tms:dispatch:create')"
      >
        <div class="config-fields">
          <el-form-item label="配置编号" required
            ><el-input v-model="form.templateNo" maxlength="24" /></el-form-item
          ><el-form-item label="线路班次名称"
            ><el-input v-model="form.templateName" maxlength="100"
          /></el-form-item>
        </div>
        <div class="config-fields">
          <el-form-item label="启用">
            <el-switch v-model="form.isEnable" />
          </el-form-item>
        </div>
        <div class="flex-bc mb-3">
          <h3>线路节点与每日时刻</h3>
          <el-button @click="addStop">添加经停点</el-button>
        </div>
        <el-table ref="nodeTableRef" :data="form.nodes" border row-key="_key">
          <el-table-column width="44" align="center"
            ><template #default
              ><span class="drag-handle" title="拖动调整顺序">⠿</span></template
            ></el-table-column
          >
          <el-table-column label="节点" min-width="220"
            ><template #default="{ row, $index }"
              ><span class="node-role">{{
                $index === 0
                  ? "始发点"
                  : $index === form.nodes.length - 1
                    ? "终点"
                    : "经停点"
              }}</span
              ><el-select
                v-model="row.nodeId"
                filterable
                remote
                :remote-method="searchNodes"
                @change="changed(row as TemplateNode)"
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
          <el-table-column label="到达时刻" min-width="170"
            ><template #default="{ row, $index }"
              ><div class="time-cell">
                <el-time-picker
                  v-model="row.arriveTime"
                  value-format="HH:mm"
                  format="HH:mm"
                  class="time-input"
                /><el-tag
                  v-if="dayOffsets()[$index].arrive > 0"
                  size="small"
                  type="warning"
                  >D+{{ dayOffsets()[$index].arrive }}</el-tag
                >
              </div></template
            ></el-table-column
          >
          <el-table-column label="发车时刻" min-width="190"
            ><template #default="{ row, $index }"
              ><div class="time-cell">
                <el-time-picker
                  v-model="row.departTime"
                  value-format="HH:mm"
                  format="HH:mm"
                  class="time-input"
                  :placeholder="
                    $index === form.nodes.length - 1 ? '可不填' : '时刻'
                  "
                /><el-tag
                  v-if="row.departTime && dayOffsets()[$index].depart > 0"
                  size="small"
                  type="warning"
                  >D+{{ dayOffsets()[$index].depart }}</el-tag
                >
              </div></template
            ></el-table-column
          >
          <el-table-column label="操作" width="72" align="center"
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
        <p class="config-help">
          每日时刻使用 24
          小时制；第一行是始发点，最后一行是终点，中间为经停点，可拖动行首 ⠿
          调整顺序。后一站时刻早于前一站发车时自动顺延至次日并标记
          D+1；同行内到达时刻不能晚于发车时刻；终点发车时刻可不填。
        </p>
        <div class="flex-bc mt-5 mb-3">
          <h3>班次生成规则</h3>
          <el-button @click="form.genRules.push(emptyRule() as ShiftRule)"
            >添加规则</el-button
          >
        </div>
        <div
          v-for="(rule, index) in form.genRules"
          :key="(rule as RuleUi)._key ?? index"
          class="rule-card"
        >
          <div class="rule-head">
            <span class="rule-dot" />
            <span class="rule-title">{{
              rule.ruleName?.trim() || `规则 ${index + 1}`
            }}</span>
            <span class="rule-head-label">启用</span>
            <el-switch v-model="rule.isEnable" size="small" />
            <button
              class="rule-close"
              type="button"
              title="删除规则"
              @click="form.genRules.splice(index, 1)"
            >
              ×
            </button>
          </div>
          <div class="rule-body">
            <div class="rule-line">
              <el-form-item label="规则名称" class="grow"
                ><el-input v-model="rule.ruleName" maxlength="100"
              /></el-form-item>
              <el-form-item label="提前天数" required
                ><el-input-number
                  :model-value="Number(rule.advanceDays) || 0"
                  :min="0"
                  :max="366"
                  :step="1"
                  step-strictly
                  controls-position="right"
                  class="advance-input"
                  @update:model-value="
                    (rule as RuleUi).advanceDays = String($event ?? 0)
                  "
              /></el-form-item>
            </div>
            <div class="rule-line">
              <el-form-item label="触发星期" required
                ><el-select
                  v-model="(rule as RuleUi)._weekdays"
                  multiple
                  collapse-tags
                  class="week-select"
                  @change="syncWeekdays(rule as RuleUi)"
                  ><el-option
                    v-for="code in WEEK_DOW"
                    :key="code"
                    :label="`周${WEEK_CN[code]}`"
                    :value="code" /></el-select
                ><span class="cron-desc"
                  >后台定时任务每日扫描，命中所选星期即自动生成班次</span
                ></el-form-item
              >
            </div>
            <div class="rule-line">
              <el-form-item label="生效开始" required
                ><el-date-picker
                  v-model="rule.effectiveStartDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="必填，过去或未来的日期均可"
              /></el-form-item>
              <el-form-item label="生效结束"
                ><el-date-picker
                  v-model="rule.effectiveEndDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="不填 = 长期有效"
              /></el-form-item>
            </div>
          </div>
        </div>
        <el-form-item label="备注" class="mt-4"
          ><el-input v-model="form.remark" maxlength="255"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button :disabled="busy" @click="open = false">关闭</el-button
        ><el-button
          v-if="hasPerms('tms:dispatch:create')"
          type="primary"
          :loading="busy"
          @click="save"
          >保存</el-button
        ></template
      >
    </BusinessDialog>
  </div>
</template>
<style scoped>
.config-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.config-help {
  display: block;
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--tms-muted);
}

.node-role {
  margin-right: 8px;
  font-size: 12px;
  color: var(--tms-muted);
}

.drag-handle {
  font-size: 14px;
  color: var(--tms-muted);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.time-cell {
  display: flex;
  gap: 6px;
  align-items: center;
}

.time-input {
  flex: 1;
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

.rule-card {
  margin: 12px 0;
  overflow: hidden;
  background: var(--tms-soft);
  border: 1px solid var(--tms-line);
  border-radius: 10px;
}

.rule-head {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 14px;
  background: var(--el-color-primary-light-9);
  border-bottom: 1px solid var(--tms-line);
}

.rule-dot {
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
  border-radius: 50%;
}

.rule-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.rule-head-label {
  font-size: 12px;
  color: var(--tms-muted);
}

.rule-close {
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  color: var(--tms-muted);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.rule-close:hover {
  color: #fff;
  background: var(--el-color-danger);
}

.rule-body {
  padding: 18px 16px 4px;
}

.rule-line {
  display: flex;
  gap: 16px;
}

.rule-line > .el-form-item {
  flex: 1;
  min-width: 0;
}

.rule-line > .el-form-item.grow {
  flex: 2;
}

.advance-input {
  width: 140px;
}

.week-select {
  min-width: 200px;
}

.cron-desc {
  display: block;
  margin: 0 0 0 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--tms-muted);
}

@media (width <= 700px) {
  .config-fields {
    grid-template-columns: 1fr;
  }

  .rule-line {
    flex-direction: column;
    gap: 0;
  }
}
</style>
