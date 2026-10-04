<script setup lang="ts">
import { ref, watch } from "vue";
import {
  queueTicketApi,
  formatTime,
  type QueueTicket,
  type QueueTicketLog
} from "@/api/tms";
import BusinessDrawer from "@/components/Tms/BusinessDrawer.vue";
import StatusTag from "@/components/Tms/StatusTag.vue";
import { message } from "@/utils/message";
const props = defineProps<{ ticket?: QueueTicket }>();
const open = defineModel<boolean>({ required: true });
const logs = ref<QueueTicketLog[]>([]);
const detail = ref<QueueTicket>();
const loading = ref(false);
let requestId = 0;
watch([open, () => props.ticket], async () => {
  const id = ++requestId;
  logs.value = [];
  detail.value = props.ticket;
  if (!open.value || !props.ticket) return;
  loading.value = true;
  try {
    const [record, list] = await Promise.all([
      queueTicketApi.findById(props.ticket.ticketId),
      queueTicketApi.log(props.ticket.ticketId)
    ]);
    if (id === requestId) {
      detail.value = record;
      logs.value = list;
    }
  } catch (error) {
    if (id === requestId) message(String(error), { type: "error" });
  } finally {
    if (id === requestId) loading.value = false;
  }
});
const events = {
  TAKE: "取号",
  CALL: "叫号",
  START_USE: "开始使用",
  COMPLETE: "完成",
  CANCEL: "取消",
  TIMEOUT_DEFER: "超时后移",
  TIMEOUT_CANCEL: "超时取消",
  STATUS_CHANGE: "状态变更"
};
</script>
<template>
  <BusinessDrawer
    v-model="open"
    :title="`排队号详情：${ticket?.ticketNo || ''}`"
    :loading="loading"
  >
    <el-descriptions v-if="detail" :column="2" border>
      <el-descriptions-item label="排队号">{{
        detail.ticketNo
      }}</el-descriptions-item>
      <el-descriptions-item label="状态"
        ><StatusTag :value="detail.status"
      /></el-descriptions-item>
      <el-descriptions-item
        v-for="field in [
          ['ticketId', '号ID'],
          ['queueId', '场景ID'],
          ['ticketTypeId', '号型ID'],
          ['businessDate', '业务日期'],
          ['userId', '用户'],
          ['resourceId', '资源'],
          ['callCount', '叫号次数'],
          ['cancelReason', '取消原因']
        ]"
        :key="field[0]"
        :label="field[1]"
        >{{ detail[field[0]] ?? "-" }}</el-descriptions-item
      >
      <el-descriptions-item
        v-for="field in [
          ['createTime', '取号时间'],
          ['calledTime', '叫号时间'],
          ['startUseTime', '使用时间'],
          ['finishTime', '完成时间']
        ]"
        :key="field[0]"
        :label="field[1]"
        >{{ formatTime(detail[field[0]]) }}</el-descriptions-item
      >
    </el-descriptions>
    <el-divider>流转日志</el-divider>
    <el-empty v-if="!logs.length && !loading" description="暂无日志" />
    <el-timeline
      ><el-timeline-item
        v-for="log in logs"
        :key="log.logId"
        :timestamp="formatTime(log.eventTime)"
        ><b>{{ events[log.eventType] || log.eventType }}</b>
        <p>{{ log.detail || "-" }}</p>
        <p>
          操作人：{{ log.operator || "-" }} · {{ log.fromStatus ?? "-" }} →
          {{ log.toStatus ?? "-" }}
        </p></el-timeline-item
      ></el-timeline
    >
  </BusinessDrawer>
</template>
