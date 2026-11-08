<script setup lang="ts">
import { reactive, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import {
  relationApi,
  type NodeServiceRelation,
  type NodeServiceRelationInput
} from "@/api/tmsExpress";
import type { LogisticNode } from "@/api/tms";

const props = defineProps<{
  relation?: NodeServiceRelation;
  nodes: LogisticNode[];
}>();
const emit = defineEmits<{ saved: [] }>();
const form = reactive<NodeServiceRelationInput>({
  relationId: props.relation?.relationId,
  upstreamNodeId: props.relation?.upstreamNodeId ?? "",
  downstreamNodeId: props.relation?.downstreamNodeId ?? "",
  isEnable: props.relation?.isEnable ?? true,
  remark: props.relation?.remark ?? ""
});
const busy = shallowRef(false);
async function save() {
  if (!form.upstreamNodeId || !form.downstreamNodeId) {
    ElMessage.error("请选择上游和下游节点");
    return;
  }
  if (String(form.upstreamNodeId) === String(form.downstreamNodeId)) {
    ElMessage.error("上游和下游不能相同");
    return;
  }
  busy.value = true;
  try {
    await relationApi.save({ ...form });
    ElMessage.success("配送关系已保存");
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
    <el-form-item label="上游节点" required
      ><el-select v-model="form.upstreamNodeId" filterable style="width: 100%"
        ><el-option
          v-for="node in nodes"
          :key="node.id"
          :value="node.id"
          :label="node.name" /></el-select
    ></el-form-item>
    <el-form-item label="下游节点" required
      ><el-select v-model="form.downstreamNodeId" filterable style="width: 100%"
        ><el-option
          v-for="node in nodes"
          :key="node.id"
          :value="node.id"
          :label="node.name" /></el-select
    ></el-form-item>
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
