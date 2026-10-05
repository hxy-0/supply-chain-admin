<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  queueConfigApi,
  queueTicketApi,
  formatTime,
  type QueueConfig,
  type QueueTicket,
  type QueueTicketType,
  type QueueResource
} from "@/api/tms";
import StatusTag from "@/components/Tms/StatusTag.vue";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import SceneEditDialog from "./components/SceneEditDialog.vue";
import SceneDetailDialog from "./components/SceneDetailDialog.vue";
import TicketDetailDrawer from "./components/TicketDetailDrawer.vue";

defineOptions({ name: "TmsQueue" });
const route = useRoute();
const tab = computed(() => route.path.split("/").pop());
const loading = ref(false),
  acting = ref(false),
  optionsLoading = ref(false);
const queues = ref<QueueConfig[]>([]),
  configs = ref<QueueConfig[]>([]),
  tickets = ref<QueueTicket[]>([]),
  types = ref<QueueTicketType[]>([]),
  resources = ref<QueueResource[]>([]);
const queueId = ref(""),
  typeId = ref(""),
  resourceId = ref(""),
  userId = ref("");
const total = ref(0),
  configTotal = ref(0);
const query = reactive({
  pageNum: 1,
  pageSize: 10,
  ticketNo: "",
  status: undefined as number | undefined,
  businessDate: ""
});
const configQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  queueCode: "",
  queueName: "",
  isEnable: undefined as number | undefined
});
const editOpen = ref(false),
  detailOpen = ref(false),
  resultOpen = ref(false);
const editing = ref<QueueConfig>(),
  selected = ref<QueueTicket>(),
  taken = ref<QueueTicket>();
const sceneDetailOpen = ref(false),
  sceneDetail = ref<QueueConfig>();
const autoRefresh = ref(true),
  autoCallNext = ref(false),
  now = ref(Date.now());
const enabledQueues = computed(() =>
  tab.value === "ticket-record"
    ? queues.value
    : queues.value.filter(q => q.isEnable !== 0)
);
const waiting = computed(() => tickets.value.filter(t => t.status === 10));
const calling = computed(() => tickets.value.filter(t => t.status === 20));
const using = computed(() => tickets.value.filter(t => t.status === 30));
const counts = ref<Record<string, number>>({});
let optionRequest = 0,
  dataRequest = 0;
async function loadConfigs() {
  loading.value = true;
  try {
    const page = await queueConfigApi.page(configQuery);
    configs.value = page.records;
    configTotal.value = page.total;
  } finally {
    loading.value = false;
  }
}
async function loadQueues() {
  const list: QueueConfig[] = [];
  let pageNum = 1;
  while (true) {
    const page = await queueConfigApi.page({ pageNum, pageSize: 100 });
    list.push(...page.records);
    if (!page.records.length || list.length >= page.total) break;
    pageNum++;
  }
  queues.value = list;
  if (!enabledQueues.value.some(q => q.queueId === queueId.value))
    queueId.value = enabledQueues.value[0]?.queueId || "";
}
async function loadOptions() {
  const version = ++optionRequest;
  ++dataRequest;
  typeId.value = "";
  resourceId.value = "";
  types.value = [];
  resources.value = [];
  tickets.value = [];
  total.value = 0;
  counts.value = {};
  loading.value = false;
  optionsLoading.value = false;
  const id = queueId.value;
  if (!id) return;
  optionsLoading.value = true;
  try {
    const [list, res] = await Promise.all([
      queueConfigApi.findEnabledTicketTypes(id),
      queueTicketApi.resources(id)
    ]);
    if (version !== optionRequest) return;
    types.value = list;
    resources.value = res;
    typeId.value =
      tab.value === "ticket-record" ? "" : list[0]?.ticketTypeId || "";
    if (!typeId.value) await loadTickets();
  } finally {
    if (version === optionRequest) optionsLoading.value = false;
  }
}
async function loadTickets() {
  const version = ++dataRequest;
  const id = queueId.value,
    tid = typeId.value,
    currentTab = tab.value;
  if (!id || (currentTab !== "ticket-record" && !tid)) {
    tickets.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    if (currentTab === "take-number") {
      const lists = await Promise.all(
        types.value.map(t => queueTicketApi.waiting(id, t.ticketTypeId))
      );
      if (version !== dataRequest) return;
      counts.value = Object.fromEntries(
        types.value.map((t, i) => [t.ticketTypeId, lists[i].length])
      );
      tickets.value =
        lists[types.value.findIndex(t => t.ticketTypeId === tid)] || [];
    } else if (currentTab === "call-board") {
      const [list, page] = await Promise.all([
        queueTicketApi.waiting(id, tid),
        queueTicketApi.page({
          pageNum: 1,
          pageSize: 100,
          queueId: id,
          ticketTypeId: tid,
          statuses: [20, 30]
        })
      ]);
      if (version !== dataRequest) return;
      tickets.value = [...list, ...page.records];
    } else {
      const page = await queueTicketApi.page({
        ...query,
        queueId: id,
        ticketTypeId: tid || undefined,
        ticketNo: query.ticketNo.trim() || undefined,
        businessDate: query.businessDate || undefined
      });
      if (version !== dataRequest) return;
      tickets.value = page.records;
      total.value = page.total;
    }
  } finally {
    if (version === dataRequest) loading.value = false;
  }
}
async function run(operation: () => Promise<unknown>) {
  if (acting.value) return;
  acting.value = true;
  try {
    await operation();
    await loadTickets();
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    acting.value = false;
  }
}
async function callNext() {
  if (!waiting.value.length)
    return message("当前没有等待中的排队号", { type: "warning" });
  if (calling.value.length) {
    try {
      await ElMessageBox.confirm(
        "已有叫号中的号，确认继续叫下一位？",
        "确认叫号"
      );
    } catch {
      return;
    }
  }
  await run(async () => {
    const ticket = await queueTicketApi.callNext(
      queueId.value,
      typeId.value,
      resourceId.value || undefined
    );
    message(`已叫号：${ticket.ticketNo}`, { type: "success" });
  });
}
async function act(action: string, row: Record<string, any>) {
  const ticket = row as QueueTicket;
  let reason: string | undefined;
  if (action === "cancel") {
    try {
      const result = await ElMessageBox.prompt(
        "请输入取消原因",
        `取消 ${ticket.ticketNo}`,
        {
          inputValue: "管理台手动取消",
          inputValidator: value => !!value?.trim() || "请输入原因"
        }
      );
      reason = result.value;
    } catch {
      return;
    }
  }
  await run(async () => {
    if (action === "start")
      await queueTicketApi.startUse(
        ticket.ticketId,
        resourceId.value || undefined
      );
    if (action === "complete") {
      const result = await queueTicketApi.complete({
        ticketId: ticket.ticketId,
        resourceId: resourceId.value || undefined,
        autoCallNext: autoCallNext.value
      });
      if (result.nextTicket)
        message(`自动叫号：${result.nextTicket.ticketNo}`, { type: "success" });
    }
    if (action === "cancel")
      await queueTicketApi.cancel(ticket.ticketId, reason);
    message("操作成功", { type: "success" });
  });
}
function view(ticket: Record<string, any>) {
  selected.value = ticket as QueueTicket;
  detailOpen.value = true;
}
async function edit(config?: Record<string, any>) {
  editing.value = config as QueueConfig;
  editOpen.value = true;
}
function viewScene(scene: Record<string, any>) {
  sceneDetail.value = scene as QueueConfig;
  sceneDetailOpen.value = true;
}
async function saved() {
  await Promise.all([loadConfigs(), loadQueues()]);
  await loadOptions();
}
async function take(ticketTypeId: string) {
  await run(async () => {
    taken.value = await queueTicketApi.take({
      queueId: queueId.value,
      ticketTypeId,
      userId: userId.value.trim() || undefined
    });
    resultOpen.value = true;
  });
}
async function expired() {
  await run(async () => {
    const count = await queueTicketApi.processExpired();
    message(`已处理 ${count} 个超时叫号`, { type: "success" });
  });
}
function report(error: unknown) {
  message(String(error), { type: "error" });
}
watch(queueId, () => {
  query.pageNum = 1;
  loadOptions().catch(report);
});
watch(typeId, () => {
  resourceId.value = "";
  query.pageNum = 1;
  loadTickets().catch(report);
});
watch(tab, () => {
  ++dataRequest;
  detailOpen.value = false;
  loadQueues().then(loadOptions).catch(report);
  if (tab.value === "config") loadConfigs().catch(report);
});
onMounted(() => {
  loadQueues().catch(report);
  if (tab.value === "config") loadConfigs().catch(report);
});
const timer = window.setInterval(() => {
  now.value = Date.now();
  if (
    autoRefresh.value &&
    tab.value === "call-board" &&
    !loading.value &&
    !acting.value
  )
    loadTickets().catch(report);
}, 10000);
const clock = window.setInterval(() => {
  now.value = Date.now();
}, 1000);
onUnmounted(() => {
  clearInterval(timer);
  clearInterval(clock);
  ++optionRequest;
  ++dataRequest;
});
</script>
<template>
  <div>
    <template v-if="tab === 'config'">
      <el-card shadow="never" class="mb-4"
        ><el-form
          inline
          @submit.prevent="
            configQuery.pageNum = 1;
            loadConfigs().catch(report);
          "
        >
          <el-form-item
            ><el-input
              v-model="configQuery.queueCode"
              placeholder="场景编码"
              clearable /></el-form-item
          ><el-form-item
            ><el-input
              v-model="configQuery.queueName"
              placeholder="场景名称"
              clearable
          /></el-form-item>
          <el-form-item
            ><el-select
              v-model="configQuery.isEnable"
              placeholder="状态"
              clearable
              style="width: 120px"
              ><el-option label="启用" :value="1" /><el-option
                label="停用"
                :value="0" /></el-select
          ></el-form-item>
          <el-form-item
            ><el-button type="primary" native-type="submit">查询</el-button
            ><el-button
              @click="
                Object.assign(configQuery, {
                  pageNum: 1,
                  queueCode: '',
                  queueName: '',
                  isEnable: undefined
                });
                loadConfigs().catch(report);
              "
              >重置</el-button
            ><el-button type="success" @click="edit()"
              >新增场景</el-button
            ></el-form-item
          >
        </el-form></el-card
      >
      <el-card shadow="never"
        ><el-table v-loading="loading" :data="configs" row-key="queueId">
          <el-table-column
            prop="queueCode"
            label="场景编码"
            min-width="150"
          /><el-table-column
            prop="queueName"
            label="场景名称"
            min-width="150"
          /><el-table-column
            prop="sceneCode"
            label="业务分类"
          /><el-table-column
            prop="callTimeoutSeconds"
            label="叫号超时（秒）"
          /><el-table-column
            prop="deferredPosition"
            label="过号后移位数"
          /><el-table-column prop="maxCallCount" label="最大叫号次数" />
          <el-table-column label="状态"
            ><template #default="s"
              ><StatusTag :value="s.row.isEnable" config /></template
          ></el-table-column>
          <el-table-column label="操作"
            ><template #default="s"
              ><el-button link type="primary" @click="viewScene(s.row)"
                >详情</el-button
              ><el-button link type="primary" @click="edit(s.row)"
                >编辑</el-button
              ></template
            ></el-table-column
          > </el-table
        ><el-pagination
          v-model:current-page="configQuery.pageNum"
          v-model:page-size="configQuery.pageSize"
          class="mt-4 justify-end"
          :total="configTotal"
          layout="total, sizes, prev, pager, next"
          @change="loadConfigs().catch(report)"
      /></el-card>
    </template>
    <template v-else>
      <el-card shadow="never" class="mb-4"
        ><div class="flex flex-wrap gap-3">
          <el-select
            v-model="queueId"
            placeholder="排队场景"
            filterable
            style="width: 230px"
            ><el-option
              v-for="q in enabledQueues"
              :key="q.queueId"
              :label="`${q.queueName} (${q.queueCode})`"
              :value="q.queueId"
          /></el-select>
          <el-select
            v-model="typeId"
            placeholder="号型"
            :clearable="tab === 'ticket-record'"
            :loading="optionsLoading"
            style="width: 180px"
            ><el-option
              v-for="t in types"
              :key="t.ticketTypeId"
              :label="`${t.ticketTypeName} (${t.prefix})`"
              :value="t.ticketTypeId"
          /></el-select>
          <template v-if="tab === 'call-board'"
            ><el-select
              v-model="resourceId"
              placeholder="资源（选填）"
              clearable
              style="width: 180px"
              ><el-option
                v-for="r in resources.filter(
                  r => !r.ticketTypeId || r.ticketTypeId === typeId
                )"
                :key="r.resourceId"
                :label="`${r.resourceNo || ''} ${r.resourceName || ''}`"
                :value="r.resourceId" /></el-select
            ><el-button
              type="primary"
              :disabled="!typeId || optionsLoading"
              :loading="acting"
              @click="callNext"
              >叫下一个号</el-button
            ><el-switch
              v-model="autoRefresh"
              active-text="自动刷新" /><el-switch
              v-model="autoCallNext"
              active-text="完成后自动叫号"
          /></template>
          <el-input
            v-if="tab === 'take-number'"
            v-model="userId"
            placeholder="用户ID（选填）"
            style="width: 200px"
          />
          <template v-if="tab === 'ticket-record'"
            ><el-input
              v-model="query.ticketNo"
              placeholder="排队号"
              clearable
              style="width: 140px"
            /><el-select
              v-model="query.status"
              placeholder="状态"
              clearable
              style="width: 140px"
              ><el-option
                v-for="(label, value) in {
                  10: '排队中',
                  20: '叫号中',
                  30: '使用中',
                  40: '已完成',
                  50: '已取消'
                }"
                :key="value"
                :label="label"
                :value="Number(value)" /></el-select
            ><el-date-picker
              v-model="query.businessDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="业务日期"
            /><el-button
              type="primary"
              @click="
                query.pageNum = 1;
                loadTickets().catch(report);
              "
              >查询</el-button
            ><el-button
              @click="
                Object.assign(query, {
                  pageNum: 1,
                  ticketNo: '',
                  status: undefined,
                  businessDate: ''
                });
                typeId = '';
                loadTickets().catch(report);
              "
              >重置</el-button
            ></template
          >
          <el-button
            :disabled="optionsLoading"
            @click="loadTickets().catch(report)"
            >刷新</el-button
          ><el-button
            v-if="tab !== 'take-number'"
            :loading="acting"
            @click="expired"
            >处理超时</el-button
          >
        </div></el-card
      >
      <el-row v-if="tab === 'take-number'" :gutter="16" class="mb-4"
        ><el-col v-for="t in types" :key="t.ticketTypeId" :xs="24" :sm="8"
          ><el-card shadow="never"
            ><h3>{{ t.ticketTypeName }}</h3>
            <p>等待 {{ counts[t.ticketTypeId] || 0 }} 人</p>
            <el-button
              type="primary"
              :loading="acting"
              :disabled="optionsLoading"
              @click="take(t.ticketTypeId)"
              >取号</el-button
            ><el-button @click="typeId = t.ticketTypeId"
              >查看队列</el-button
            ></el-card
          ></el-col
        ></el-row
      >
      <el-row v-if="tab === 'call-board'" :gutter="16" class="mb-4"
        ><el-col
          v-for="stat in [
            ['等待中', waiting.length],
            ['叫号中', calling.length],
            ['使用中', using.length]
          ]"
          :key="String(stat[0])"
          :span="8"
          ><el-card shadow="never"
            ><el-statistic
              :title="String(stat[0])"
              :value="Number(stat[1])" /></el-card></el-col
      ></el-row>
      <el-card shadow="never"
        ><el-table v-loading="loading" :data="tickets" row-key="ticketId">
          <el-table-column prop="ticketNo" label="排队号" /><el-table-column
            label="状态"
            ><template #default="s"
              ><StatusTag :value="s.row.status" /></template></el-table-column
          ><el-table-column prop="userId" label="用户" /><el-table-column
            prop="businessDate"
            label="业务日期"
          /><el-table-column prop="callCount" label="叫号次数" />
          <el-table-column v-if="tab === 'call-board'" label="叫号剩余"
            ><template #default="s">{{
              s.row.status === 20 && s.row.callDeadlineTime
                ? `${Math.max(0, Math.ceil((s.row.callDeadlineTime - now) / 1000))}秒`
                : "-"
            }}</template></el-table-column
          >
          <el-table-column label="取号时间" min-width="170"
            ><template #default="s">{{
              formatTime(s.row.createTime)
            }}</template></el-table-column
          >
          <el-table-column label="操作" width="250" fixed="right"
            ><template #default="s"
              ><el-button link type="primary" @click="view(s.row)"
                >详情</el-button
              ><el-button
                v-if="tab === 'call-board' && s.row.status === 20"
                link
                type="primary"
                :disabled="acting"
                @click="act('start', s.row)"
                >开始使用</el-button
              ><el-button
                v-if="tab === 'call-board' && s.row.status === 30"
                link
                type="success"
                :disabled="acting"
                @click="act('complete', s.row)"
                >完成</el-button
              ><el-button
                v-if="
                  [10, 20, 30].includes(s.row.status) && tab !== 'take-number'
                "
                link
                type="danger"
                :disabled="acting"
                @click="act('cancel', s.row)"
                >取消</el-button
              ></template
            ></el-table-column
          > </el-table
        ><el-pagination
          v-if="tab === 'ticket-record'"
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          class="mt-4 justify-end"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @change="loadTickets().catch(report)"
      /></el-card>
    </template>
    <SceneEditDialog
      v-model="editOpen"
      :editing="editing"
      @saved="saved().catch(report)"
    />
    <TicketDetailDrawer v-model="detailOpen" :ticket="selected" />
    <SceneDetailDialog v-model="sceneDetailOpen" :scene="sceneDetail" />
    <BusinessDialog v-model="resultOpen" title="取号成功" width="420px" readonly
      ><el-result
        icon="success"
        :title="taken?.ticketNo"
        :sub-title="`前方等待 ${Math.max(0, (counts[taken?.ticketTypeId] || 1) - 1)} 人`"
    /></BusinessDialog>
  </div>
</template>
