<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  cityWaveApi,
  type CityWaveTemplate,
  type WaveGenerationRule
} from "@/api/tmsWave";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";
import WaveRulesEditor from "./WaveRulesEditor.vue";

const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ template?: CityWaveTemplate }>();
const emit = defineEmits<{ saved: [] }>();
type Draft = {
  templateId?: string;
  templateName: string;
  cityCode: string;
  sourceNodeIds: string[];
  deliveryNodeIds: string[];
  deliveryDistrictCode: string;
  remark: string;
  generationRules: WaveGenerationRule[];
};
const empty = (): Draft => ({
  templateId: undefined,
  templateName: "",
  cityCode: "",
  sourceNodeIds: [],
  deliveryNodeIds: [],
  deliveryDistrictCode: "",
  remark: "",
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
function nodeInDraft(nodeId: string) {
  return nodes.value.some(row => row.id === nodeId);
}
async function opened() {
  Object.assign(form, empty());
  void searchNodes();
  if (props.template) {
    try {
      const detail = await cityWaveApi.detail(props.template.templateId);
      Object.assign(form, {
        templateId: detail.templateId,
        templateName: detail.templateName,
        cityCode: detail.cityCode ?? "",
        sourceNodeIds: detail.sourceNodeIds ?? [],
        deliveryNodeIds: detail.deliveryNodeIds ?? [],
        deliveryDistrictCode: detail.deliveryDistrictCode ?? "",
        remark: detail.remark ?? "",
        generationRules: detail.generationRules ?? []
      });
    } catch (error) {
      ElMessage.error(
        error instanceof Error ? error.message : "城市波次模板加载失败"
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
    await cityWaveApi.save({ ...form });
    visible.value = false;
    emit("saved");
    ElMessage.success("城市波次模板已保存");
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
    :title="form.templateId ? '编辑城市波次模板' : '新建城市波次模板'"
    width="min(900px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="110px" :disabled="busy">
      <el-row :gutter="12">
        <el-col :span="12"
          ><el-form-item label="模板名称" required
            ><el-input
              v-model="form.templateName"
              maxlength="64" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="城市编码"
            ><el-input v-model="form.cityCode" maxlength="16" /></el-form-item
        ></el-col>
      </el-row>
      <el-form-item label="提货仓节点" required
        ><el-select
          v-model="form.sourceNodeIds"
          multiple
          filterable
          remote
          :remote-method="searchNodes"
          placeholder="搜索提货仓物流节点"
          style="width: 100%"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :value="node.id"
            :label="node.name" /></el-select
      ></el-form-item>
      <el-form-item label="配送前置仓" required
        ><el-select
          v-model="form.deliveryNodeIds"
          multiple
          filterable
          remote
          :remote-method="searchNodes"
          placeholder="搜索配送前置仓节点"
          style="width: 100%"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :value="node.id"
            :label="node.name" /></el-select
      ></el-form-item>
      <el-form-item label="配送区域编码"
        ><el-input v-model="form.deliveryDistrictCode" maxlength="32"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" maxlength="255"
      /></el-form-item>
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
</style>
