<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import { queueApi, type QueueConfig, type QueueTicket, type TicketType } from "@/api/tms";

defineOptions({ name: "TmsQueue" });
const route = useRoute();
const tab = computed(() => String(route.path).split("/").pop() || "config");
const loading = ref(false);
const queues = ref<QueueConfig[]>([]);
const tickets = ref<QueueTicket[]>([]);
const types = ref<TicketType[]>([]);
const queueId = ref("");
const typeId = ref("");
const userId = ref("");
const form = ref<Partial<QueueConfig>>({ status: 1, callTimeoutSeconds: 300 });
const dialog = ref(false);

const statusName = (status: number | string) => ({ "10": "等待中", "20": "叫号中", "30": "使用中", "40": "已完成", "50": "已取消", WAITING: "等待中", CALLING: "叫号中", IN_USE: "使用中", COMPLETED: "已完成", CANCELLED: "已取消" }[String(status)] || String(status));
const time = (value?: number) => value ? new Date(value).toLocaleString() : "-";

async function loadQueues() {
  const page = await queueApi.pageConfig({ pageNum: 1, pageSize: 200 });
  queues.value = page.records || [];
  if (!queueId.value && queues.value.length) queueId.value = queues.value[0].queueId;
}
async function loadTypes() {
  types.value = queueId.value ? await queueApi.ticketTypes(queueId.value) : [];
  typeId.value = types.value[0]?.ticketTypeId || "";
}
async function loadTickets() {
  if (!queueId.value) return;
  loading.value = true;
  try {
    const page = await queueApi.tickets({ pageNum: 1, pageSize: 200, queueId: queueId.value, ticketTypeId: typeId.value || undefined });
    tickets.value = page.records || [];
  } finally { loading.value = false; }
}
async function reload() { await loadQueues(); await loadTypes(); await loadTickets(); }
async function saveConfig() { await queueApi.saveConfig(form.value); message("保存成功", { type: "success" }); dialog.value = false; await loadQueues(); }
async function take() { const t = await queueApi.take({ queueId: queueId.value, ticketTypeId: typeId.value, userId: userId.value || undefined }); message(`取号成功：${t.ticketNo}`, { type: "success" }); await loadTickets(); }
async function callNext() { const t = await queueApi.callNext(queueId.value, typeId.value); message(`已叫号：${t.ticketNo}`, { type: "success" }); await loadTickets(); }
async function act(action: "start" | "complete" | "cancel", t: any) {
  if (action === "start") await queueApi.startUse(t.ticketId);
  if (action === "complete") await queueApi.complete({ ticketId: t.ticketId, autoCallNext: false });
  if (action === "cancel") await queueApi.cancel(t.ticketId);
  message("操作成功", { type: "success" }); await loadTickets();
}
watch(queueId, async () => { await loadTypes(); await loadTickets(); });
watch(typeId, loadTickets);
onMounted(reload);
</script>

<template>
  <div>
    <el-card v-if="tab === 'config'" shadow="never">
      <template #header><div class="flex justify-between"><b>排队场景</b><el-button type="primary" @click="form={status:1,callTimeoutSeconds:300};dialog=true">新增场景</el-button></div></template>
      <el-table :data="queues" v-loading="loading">
        <el-table-column prop="queueCode" label="场景编码"/><el-table-column prop="queueName" label="场景名称"/><el-table-column prop="sceneCode" label="业务分类"/><el-table-column prop="callTimeoutSeconds" label="叫号超时(秒)"/>
        <el-table-column label="状态"><template #default="s"><el-tag :type="s.row.status === 0 || s.row.status === 'DISABLED' ? 'info' : 'success'">{{ s.row.status === 0 || s.row.status === 'DISABLED' ? '停用' : '启用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="form={...s.row};dialog=true">编辑</el-button></template></el-table-column>
      </el-table>
    </el-card>
    <template v-else>
      <el-card shadow="never" class="mb-4">
        <div class="flex flex-wrap gap-3">
          <el-select v-model="queueId" placeholder="排队场景" class="w-52"><el-option v-for="q in queues" :key="q.queueId" :label="q.queueName" :value="q.queueId"/></el-select>
          <el-select v-model="typeId" placeholder="号型" class="w-48"><el-option v-for="t in types" :key="t.ticketTypeId" :label="`${t.ticketTypeName}（${t.prefix}）`" :value="t.ticketTypeId"/></el-select>
          <el-input v-if="tab === 'take-number'" v-model="userId" placeholder="用户ID（选填）" class="w-48"/>
          <el-button v-if="tab === 'take-number'" type="primary" :disabled="!typeId" @click="take">取号</el-button>
          <el-button v-if="tab === 'call-board'" type="primary" :disabled="!typeId" @click="callNext">叫下一个号</el-button>
          <el-button @click="loadTickets">刷新</el-button>
        </div>
      </el-card>
      <el-card shadow="never">
        <el-table :data="tickets" v-loading="loading">
          <el-table-column prop="ticketNo" label="排队号"/><el-table-column label="状态"><template #default="s"><el-tag>{{ statusName(s.row.status) }}</el-tag></template></el-table-column><el-table-column prop="userId" label="用户"/><el-table-column label="取号时间"><template #default="s">{{ time(s.row.createTime) }}</template></el-table-column>
          <el-table-column v-if="tab === 'call-board'" label="操作" width="240"><template #default="s"><el-button link type="primary" @click="act('start',s.row)">开始使用</el-button><el-button link type="success" @click="act('complete',s.row)">完成</el-button><el-button link type="danger" @click="act('cancel',s.row)">取消</el-button></template></el-table-column>
        </el-table>
      </el-card>
    </template>
    <el-dialog v-model="dialog" title="排队场景" width="560px"><el-form label-width="100px"><el-form-item label="场景编码"><el-input v-model="form.queueCode"/></el-form-item><el-form-item label="场景名称"><el-input v-model="form.queueName"/></el-form-item><el-form-item label="业务分类"><el-input v-model="form.sceneCode"/></el-form-item><el-form-item label="叫号超时"><el-input-number v-model="form.callTimeoutSeconds" :min="1"/></el-form-item></el-form><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="saveConfig">保存</el-button></template></el-dialog>
  </div>
</template>
