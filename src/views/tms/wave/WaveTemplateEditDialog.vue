<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  waveTemplateApi,
  stopTypeOptions,
  type WaveTemplate,
  type WaveTemplateStop,
  type WaveGenerationRule
} from "@/api/tmsWave";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import WaveRulesEditor from "./WaveRulesEditor.vue";

const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ template?: WaveTemplate }>();
const emit = defineEmits<{ saved: [] }>();
type Draft = {
  templateId?: string;
  templateName: string;
  waveType: number;
  cityCode: string;
  remark: string;
  details: WaveTemplateStop[];
  generationRules: WaveGenerationRule[];
};
const empty = (): Draft => ({
  templateId: undefined,
  templateName: "",
  waveType: 0,
  cityCode: "",
  remark: "",
  details: [],
  generationRules: []
});
const form = reactive<Draft>(empty());
const busy = shallowRef(false);
const nodes = ref<LogisticNode[]>([]);
async function searchNodes(name = "") {
  try {
    nodes.value = (
      await logisticNodeApi.page({ name, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "节点加载失败");
  }
}
function addStop() {
  form.details.push({ stopType: 1, logisticNodeId: "" });
}
function nodeInDraft(nodeId: string) {
  return (
    nodes.value.some(row => row.id === nodeId) ||
    form.details.some(row => row.logisticNodeId === nodeId)
  );
}
async function opened() {
  Object.assign(form, empty());
  void searchNodes();
  if (props.template) {
    try {
      const detail = await waveTemplateApi.detail(props.template.templateId);
      Object.assign(form, {
        templateId: detail.templateId,
        templateName: detail.templateName,
        waveType: detail.waveType,
        cityCode: detail.cityCode ?? "",
        remark: detail.remark ?? "",
        details: detail.details ?? [],
        generationRules: detail.generationRules ?? []
      });
    } catch (error) {
      ElMessage.error(
        error instanceof Error ? error.message : "波次模板加载失败"
      );
    }
  }
}
async function save() {
  if (!form.templateName.trim()) {
    ElMessage.error("请填写模板名称");
    return;
  }
  if (
    form.details.some(
      row => !row.logisticNodeId || !String(row.logisticNodeId).trim()
    )
  ) {
    ElMessage.error("站点明细必须选择物流节点");
    return;
  }
  if (
    form.generationRules.some(
      row =>
        !row.ruleName.trim() ||
        !row.cronExpr.trim() ||
        !/^\d+$/.test(row.advanceDays)
    )
  ) {
    ElMessage.error("生成规则需填写名称、Cron 表达式和数字提前天数");
    return;
  }
  busy.value = true;
  try {
    await waveTemplateApi.save({ ...form });
    visible.value = false;
    emit("saved");
    ElMessage.success("波次模板已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    busy.value = false;
  }
}
watch(visible, value => {
  if (value) void opened();
});
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="form.templateId ? '编辑波次模板' : '新建波次模板'"
    width="min(1080px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="90px" :disabled="busy">
      <el-row :gutter="12">
        <el-col :span="8"
          ><el-form-item label="模板名称" required
            ><el-input
              v-model="form.templateName"
              maxlength="64" /></el-form-item
        ></el-col>
        <el-col :span="8"
          ><el-form-item label="模板类型" required
            ><el-radio-group v-model="form.waveType"
              ><el-radio :value="0">城配</el-radio
              ><el-radio :value="1">干线</el-radio></el-radio-group
            ></el-form-item
          ></el-col
        >
        <el-col :span="8"
          ><el-form-item label="城市编码"
            ><el-input v-model="form.cityCode" maxlength="16" /></el-form-item
        ></el-col>
      </el-row>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" maxlength="255"
      /></el-form-item>
      <p class="section-title">站点明细</p>
      <el-table :data="form.details" size="small">
        <el-table-column label="站点类型" width="110"
          ><template #default="{ row }"
            ><el-select v-model="row.stopType"
              ><el-option
                v-for="option in stopTypeOptions"
                :key="option.value"
                :value="option.value"
                :label="option.label" /></el-select></template
        ></el-table-column>
        <el-table-column label="物流节点" min-width="220"
          ><template #default="{ row }"
            ><el-select
              v-model="row.logisticNodeId"
              filterable
              remote
              :remote-method="searchNodes"
              placeholder="搜索物流节点"
              ><el-option
                v-if="row.logisticNodeId && !nodeInDraft(row.logisticNodeId)"
                :value="row.logisticNodeId"
                :label="row.logisticNodeId" /><el-option
                v-for="node in nodes"
                :key="node.id"
                :value="node.id"
                :label="node.name" /></el-select></template
        ></el-table-column>
        <el-table-column label="到达开始" width="130"
          ><template #default="{ row }"
            ><el-time-picker
              v-model="row.planArrivalStart"
              format="HH:mm"
              value-format="HH:mm"
              aria-label="计划到达开始时间" /></template
        ></el-table-column>
        <el-table-column label="到达结束" width="130"
          ><template #default="{ row }"
            ><el-time-picker
              v-model="row.planArrivalEnd"
              format="HH:mm"
              value-format="HH:mm"
              aria-label="计划到达结束时间" /></template
        ></el-table-column>
        <el-table-column label="发车开始" width="130"
          ><template #default="{ row }"
            ><el-time-picker
              v-model="row.planDepartureStart"
              format="HH:mm"
              value-format="HH:mm"
              aria-label="计划发车开始时间" /></template
        ></el-table-column>
        <el-table-column label="发车结束" width="130"
          ><template #default="{ row }"
            ><el-time-picker
              v-model="row.planDepartureEnd"
              format="HH:mm"
              value-format="HH:mm"
              aria-label="计划发车结束时间" /></template
        ></el-table-column>
        <el-table-column width="60"
          ><template #default="{ $index }"
            ><el-button
              link
              type="danger"
              @click="form.details.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button class="add-stop" size="small" @click="addStop"
        >添加站点</el-button
      >
      <p class="section-title">生成规则</p>
      <WaveRulesEditor v-model="form.generationRules" />
    </el-form>
    <template #footer
      ><el-button :disabled="busy" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>

<style scoped>
.section-title {
  padding-left: 8px;
  margin: 4px 0 12px;
  font-weight: 600;
  line-height: 1.3;
  border-left: 3px solid var(--el-color-primary);
}

.add-stop {
  margin-top: 8px;
}
</style>
