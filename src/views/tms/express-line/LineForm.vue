<script setup lang="ts">
import { reactive, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import {
  lineApi,
  type LineHaulRoute,
  type LineHaulRouteInput
} from "@/api/tmsExpress";
import type { LogisticNode } from "@/api/tms";

const props = defineProps<{
  line?: LineHaulRoute;
  nodes: LogisticNode[];
}>();
const emit = defineEmits<{ saved: [] }>();
const form = reactive<LineHaulRouteInput>({
  lineId: props.line?.lineId,
  fromNodeId: props.line?.fromNodeId ?? "",
  toNodeId: props.line?.toNodeId ?? "",
  distanceKm: props.line?.distanceKm,
  hours: props.line?.hours,
  isEnable: props.line?.isEnable ?? true,
  remark: props.line?.remark ?? ""
});
const busy = shallowRef(false);
async function save() {
  if (!form.fromNodeId || !form.toNodeId) {
    ElMessage.error("请选择起点和终点节点");
    return;
  }
  if (String(form.fromNodeId) === String(form.toNodeId)) {
    ElMessage.error("起点和终点不能相同");
    return;
  }
  busy.value = true;
  try {
    await lineApi.save({ ...form });
    ElMessage.success("线路已保存");
    emit("saved");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <el-form label-width="90px" :disabled="busy" @submit.prevent="save">
    <el-form-item label="起点节点" required
      ><el-select v-model="form.fromNodeId" filterable style="width: 100%"
        ><el-option
          v-for="node in nodes"
          :key="node.id"
          :value="node.id"
          :label="node.name" /></el-select
    ></el-form-item>
    <el-form-item label="终点节点" required
      ><el-select v-model="form.toNodeId" filterable style="width: 100%"
        ><el-option
          v-for="node in nodes"
          :key="node.id"
          :value="node.id"
          :label="node.name" /></el-select
    ></el-form-item>
    <el-form-item label="距离(km)"
      ><el-input-number
        v-model="form.distanceKm"
        :min="0"
        :precision="1"
        aria-label="线路距离"
    /></el-form-item>
    <el-form-item label="时长(h)"
      ><el-input-number
        v-model="form.hours"
        :min="0"
        :precision="1"
        aria-label="线路时长"
    /></el-form-item>
    <el-form-item label="启用"
      ><el-switch v-model="form.isEnable"
    /></el-form-item>
    <el-form-item label="备注"
      ><el-input v-model="form.remark" maxlength="255"
    /></el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="busy" native-type="submit"
        >保存</el-button
      >
    </el-form-item>
  </el-form>
</template>
