<script setup lang="ts">
import { ref, watch } from "vue";
import { queueConfigApi, type QueueConfig } from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import StatusTag from "@/components/Tms/StatusTag.vue";
const props = defineProps<{ scene?: QueueConfig }>();
const open = defineModel<boolean>({ required: true });
const detail = ref<QueueConfig>(),
  busy = ref(false);
let requestId = 0;
watch([open, () => props.scene], async () => {
  const version = ++requestId;
  detail.value = undefined;
  if (!open.value || !props.scene) return;
  busy.value = true;
  try {
    const data = await queueConfigApi.findById(props.scene.queueId);
    if (version === requestId) detail.value = data;
  } catch (error) {
    if (version === requestId) message(String(error), { type: "error" });
  } finally {
    if (version === requestId) busy.value = false;
  }
});
</script>
<template>
  <BusinessDialog
    v-model="open"
    :title="`场景详情：${scene?.queueName || ''}`"
    readonly
  >
    <div v-loading="busy">
      <template v-if="detail"
        ><el-descriptions :column="2" border
          ><el-descriptions-item label="场景编码">{{
            detail.queueCode
          }}</el-descriptions-item
          ><el-descriptions-item label="状态"
            ><StatusTag :value="detail.status" config /></el-descriptions-item
          ><el-descriptions-item label="业务分类">{{
            detail.sceneCode || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="备注">{{
            detail.remark || "-"
          }}</el-descriptions-item></el-descriptions
        ><el-table :data="detail.ticketTypes" class="mt-4"
          ><el-table-column
            prop="ticketTypeName"
            label="号型"
          /><el-table-column prop="prefix" label="前缀" /><el-table-column
            prop="sequenceLength"
            label="位数"
          /><el-table-column label="每天重置"
            ><template #default="s">{{
              s.row.dailyReset ? "是" : "否"
            }}</template></el-table-column
          ><el-table-column label="状态"
            ><template #default="s"
              ><StatusTag
                :value="s.row.status"
                config /></template></el-table-column
          ><el-table-column label="已发号"
            ><template #default="s">{{
              Math.max(0, (s.row.nextSequence || 1) - 1)
            }}</template></el-table-column
          ></el-table
        ></template
      >
    </div>
  </BusinessDialog>
</template>
