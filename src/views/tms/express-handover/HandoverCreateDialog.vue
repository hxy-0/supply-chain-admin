<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import { handoverApi, handoverTypes } from "@/api/tmsExpress";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [] }>();
const form = reactive({
  tripId: "",
  handoverType: 1,
  fromNodeId: "",
  toNodeId: "",
  waybillNos: "",
  remark: ""
});
const busy = shallowRef(false);
const nodes = ref<LogisticNode[]>([]);
async function loadNodes() {
  try {
    nodes.value = (
      await logisticNodeApi.page({ pageNum: 1, pageSize: 200 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "节点加载失败");
  }
}
async function save() {
  if (!form.fromNodeId || !form.toNodeId) {
    ElMessage.error("请选择交方和接方节点");
    return;
  }
  if (String(form.fromNodeId) === String(form.toNodeId)) {
    ElMessage.error("交方和接方节点不能相同");
    return;
  }
  const waybillNos = form.waybillNos
    .split(/[\s,，;；]+/)
    .map(row => row.trim())
    .filter(Boolean);
  if (!waybillNos.length) {
    ElMessage.error("请填写运单号（换行或逗号分隔）");
    return;
  }
  busy.value = true;
  try {
    await handoverApi.create({
      tripId: form.tripId.trim() || undefined,
      handoverType: form.handoverType,
      fromNodeId: form.fromNodeId,
      toNodeId: form.toNodeId,
      waybillNos,
      remark: form.remark.trim() || undefined
    });
    visible.value = false;
    emit("saved");
    ElMessage.success("交接单已创建");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  } finally {
    busy.value = false;
  }
}
watch(visible, value => {
  if (value) void loadNodes();
});
</script>

<template>
  <el-dialog
    v-model="visible"
    title="新建交接单"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="100px" :disabled="busy" @submit.prevent="save">
      <el-form-item label="交接类型" required
        ><el-select v-model="form.handoverType"
          ><el-option
            v-for="(label, value) in handoverTypes"
            :key="value"
            :value="Number(value)"
            :label="label" /></el-select
      ></el-form-item>
      <el-form-item label="关联车次"
        ><el-input v-model="form.tripId" maxlength="64"
      /></el-form-item>
      <el-form-item label="交方节点" required
        ><el-select v-model="form.fromNodeId" filterable style="width: 100%"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :value="node.id"
            :label="node.name" /></el-select
      ></el-form-item>
      <el-form-item label="接方节点" required
        ><el-select v-model="form.toNodeId" filterable style="width: 100%"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :value="node.id"
            :label="node.name" /></el-select
      ></el-form-item>
      <el-form-item label="运单号" required
        ><el-input
          v-model="form.waybillNos"
          type="textarea"
          :rows="4"
          placeholder="运单号，换行或逗号分隔"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" maxlength="255"
      /></el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">保存</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>
