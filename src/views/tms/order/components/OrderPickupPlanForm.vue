<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import type { PickupPlanCommand } from "@/api/tmsOrder";
import { ElMessage } from "element-plus";
import { formatDateTime } from "@/utils/date";
const form = defineModel<PickupPlanCommand>({ required: true });
const props = defineProps<{ readonly?: boolean; nodeName?: string }>();
const nodes = ref<LogisticNode[]>([]);
const pickupTime = computed({
  get: () =>
    form.value.expectPickupTime == null
      ? undefined
      : Number(form.value.expectPickupTime),
  set: value => {
    form.value.expectPickupTime = value ? Number(value) : undefined;
  }
});
async function search(name = "") {
  try {
    const page = await logisticNodeApi.page({ name, pageNum: 1, pageSize: 50 });
    nodes.value = [
      ...new Map(
        [...nodes.value, ...page.records].map(node => [node.id, node])
      ).values()
    ];
    if (
      form.value.pickupNodeId &&
      !nodes.value.some(node => node.id === form.value.pickupNodeId)
    ) {
      nodes.value.push(await logisticNodeApi.get(form.value.pickupNodeId));
    }
  } catch (reason) {
    ElMessage.error(
      reason instanceof Error ? reason.message : "加载提货点失败"
    );
  }
}

watch(
  () => props.readonly,
  value => {
    if (!value) search();
  },
  { immediate: true }
);
</script>
<template>
  <el-row :gutter="16">
    <el-col :span="12"
      ><el-form-item label="提货点" prop="pickupNodeId" required>
        <span v-if="readonly">{{
          nodeName || form.pickupNodeId || "待补充"
        }}</span>
        <el-select
          v-else
          v-model="form.pickupNodeId"
          filterable
          remote
          :remote-method="search"
          placeholder="搜索提货物流节点"
        >
          <el-option
            v-for="node in nodes"
            :key="node.id"
            :label="node.name"
            :value="node.id"
          />
        </el-select> </el-form-item
    ></el-col>
    <el-col :span="12"
      ><el-form-item label="计划包裹数" prop="plannedPackageCount" required>
        <span v-if="readonly">{{ form.plannedPackageCount ?? "待补充" }}</span>
        <el-input-number
          v-else
          v-model="form.plannedPackageCount"
          :min="1"
          :max="2147483647"
          :precision="0"
          :step="1"
          step-strictly
        /> </el-form-item
    ></el-col>
    <el-col :span="12"
      ><el-form-item label="发货人" prop="senderName" required
        ><el-input
          v-model="form.senderName"
          maxlength="100"
          :disabled="readonly" /></el-form-item
    ></el-col>
    <el-col :span="12"
      ><el-form-item label="发货电话" prop="senderPhone" required
        ><el-input
          v-model="form.senderPhone"
          maxlength="32"
          :disabled="readonly" /></el-form-item
    ></el-col>
    <el-col :span="12"
      ><el-form-item label="计划提货时间" prop="expectPickupTime" required>
        <span v-if="readonly">{{ formatDateTime(form.expectPickupTime) }}</span>
        <el-date-picker
          v-else
          v-model="pickupTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
        /> </el-form-item
    ></el-col>
  </el-row>
</template>
