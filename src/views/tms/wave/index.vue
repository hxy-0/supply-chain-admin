<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  waveTemplateApi,
  cityWaveApi,
  waveScheduleApi,
  waveGenerationApi,
  waveTypeLabel,
  type WaveTemplate,
  type CityWaveTemplate
} from "@/api/tmsWave";
import WaveTemplateEditDialog from "./WaveTemplateEditDialog.vue";
import CityWaveEditDialog from "./CityWaveEditDialog.vue";

defineOptions({ name: "TmsWave" });

const activeTab = shallowRef("template");
const templateQuery = reactive({ templateName: "", pageNum: 1, pageSize: 20 });
const templates = ref<WaveTemplate[]>([]);
const templateTotal = shallowRef(0);
const templateLoading = shallowRef(false);
const templateEditing = shallowRef(false);
const templateSelected = ref<WaveTemplate>();
let templateVersion = 0;
async function loadTemplates(reset = false) {
  if (reset) templateQuery.pageNum = 1;
  const current = ++templateVersion;
  templateLoading.value = true;
  try {
    const page = await waveTemplateApi.page({ ...templateQuery });
    if (current === templateVersion) {
      templates.value = page.records;
      templateTotal.value = Number(page.total);
    }
  } catch (error) {
    if (current === templateVersion)
      ElMessage.error(error instanceof Error ? error.message : "模板加载失败");
  } finally {
    if (current === templateVersion) templateLoading.value = false;
  }
}
function createTemplate() {
  templateSelected.value = undefined;
  templateEditing.value = true;
}
function editTemplate(row: WaveTemplate) {
  templateSelected.value = row;
  templateEditing.value = true;
}
async function removeTemplate(row: WaveTemplate) {
  try {
    await ElMessageBox.confirm(
      `删除波次模板「${row.templateName}」？历史波次不受影响。`,
      "删除模板",
      { type: "warning" }
    );
    await waveTemplateApi.remove(row.templateId);
    ElMessage.success("模板已删除");
    await loadTemplates();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}

const cityQuery = reactive({ templateName: "", pageNum: 1, pageSize: 20 });
const cityTemplates = ref<CityWaveTemplate[]>([]);
const cityTotal = shallowRef(0);
const cityLoading = shallowRef(false);
const cityEditing = shallowRef(false);
const citySelected = ref<CityWaveTemplate>();
let cityVersion = 0;
async function loadCity(reset = false) {
  if (reset) cityQuery.pageNum = 1;
  const current = ++cityVersion;
  cityLoading.value = true;
  try {
    const page = await cityWaveApi.page({ ...cityQuery });
    if (current === cityVersion) {
      cityTemplates.value = page.records;
      cityTotal.value = Number(page.total);
    }
  } catch (error) {
    if (current === cityVersion)
      ElMessage.error(
        error instanceof Error ? error.message : "城市模板加载失败"
      );
  } finally {
    if (current === cityVersion) cityLoading.value = false;
  }
}
function createCity() {
  citySelected.value = undefined;
  cityEditing.value = true;
}
function editCity(row: CityWaveTemplate) {
  citySelected.value = row;
  cityEditing.value = true;
}
async function removeCity(row: CityWaveTemplate) {
  try {
    await ElMessageBox.confirm(
      `删除城市波次模板「${row.templateName}」？`,
      "删除模板",
      { type: "warning" }
    );
    await cityWaveApi.remove(row.templateId);
    ElMessage.success("模板已删除");
    await loadCity();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}

const scheduleForm = reactive({
  waveId: "",
  planDepartTime: "",
  planCompleteTime: "",
  schedulerName: "",
  remark: ""
});
const scheduleBusy = shallowRef(false);
async function submitSchedule(mode: "create" | "update") {
  if (!scheduleForm.waveId.trim() || !scheduleForm.planDepartTime) {
    ElMessage.error("请填写波次 ID 和计划发车时间");
    return;
  }
  const cmd = {
    waveId: scheduleForm.waveId.trim(),
    planDepartTime: Number(scheduleForm.planDepartTime),
    planCompleteTime: scheduleForm.planCompleteTime
      ? Number(scheduleForm.planCompleteTime)
      : undefined,
    schedulerName: scheduleForm.schedulerName.trim() || undefined,
    remark: scheduleForm.remark.trim() || undefined
  };
  scheduleBusy.value = true;
  try {
    const ok =
      mode === "create"
        ? await waveScheduleApi.create(cmd)
        : await waveScheduleApi.update(cmd);
    if (ok === false) throw new Error("排程保存失败");
    ElMessage.success(mode === "create" ? "排程已创建" : "排程已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "排程保存失败");
  } finally {
    scheduleBusy.value = false;
  }
}
async function cancelSchedule() {
  if (!scheduleForm.waveId.trim()) {
    ElMessage.error("请填写要取消排程的波次 ID");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `取消波次 ${scheduleForm.waveId} 的排程？`,
      "取消排程",
      { type: "warning" }
    );
    const ok = await waveScheduleApi.cancel(scheduleForm.waveId.trim());
    if (ok === false) throw new Error("取消排程失败");
    ElMessage.success("排程已取消");
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}

const generateForm = reactive({
  templateId: "",
  targetDate: "",
  endDate: "",
  ruleId: "",
  calcStart: "",
  calcEnd: "",
  cronExpr: ""
});
const generateBusy = shallowRef(false);
const templateOptions = ref<WaveTemplate[]>([]);
async function loadTemplateOptions() {
  try {
    templateOptions.value = (
      await waveTemplateApi.page({ pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "模板加载失败");
  }
}
function showGenerationResult(result: {
  success: boolean;
  message?: string;
  generatedWaveIds?: string[];
  generatedCount?: number;
}) {
  if (!result.success) {
    ElMessage.error(result.message || "波次生成失败");
    return;
  }
  const ids = (result.generatedWaveIds ?? []).join("、");
  ElMessageBox.alert(
    `生成 ${result.generatedCount ?? 0} 个波次${ids ? `：${ids}` : ""}`,
    "生成成功",
    { type: "success" }
  );
}
async function generateRange() {
  if (!generateForm.templateId || !generateForm.targetDate) {
    ElMessage.error("请选择波次模板和目标日期");
    return;
  }
  generateBusy.value = true;
  try {
    showGenerationResult(
      await waveGenerationApi.generate({
        templateId: generateForm.templateId,
        targetDate: generateForm.targetDate,
        endDate: generateForm.endDate || undefined
      })
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "波次生成失败");
  } finally {
    generateBusy.value = false;
  }
}
async function generateQuick(kind: "today" | "tomorrow") {
  generateBusy.value = true;
  try {
    showGenerationResult(
      kind === "today"
        ? await waveGenerationApi.generateToday()
        : await waveGenerationApi.generateTomorrow()
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "波次生成失败");
  } finally {
    generateBusy.value = false;
  }
}
async function generateManual() {
  if (!generateForm.ruleId.trim() || !generateForm.targetDate) {
    ElMessage.error("请填写规则 ID 和目标日期");
    return;
  }
  generateBusy.value = true;
  try {
    showGenerationResult(
      await waveGenerationApi.manual(
        generateForm.ruleId.trim(),
        generateForm.targetDate
      )
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "波次生成失败");
  } finally {
    generateBusy.value = false;
  }
}
const calcDates = ref<string[]>([]);
async function calculateDates() {
  if (
    !generateForm.ruleId.trim() ||
    !generateForm.calcStart ||
    !generateForm.calcEnd
  ) {
    ElMessage.error("请填写规则 ID 和起止日期");
    return;
  }
  generateBusy.value = true;
  try {
    calcDates.value = await waveGenerationApi.calculateDates(
      generateForm.ruleId.trim(),
      generateForm.calcStart,
      generateForm.calcEnd
    );
    if (!calcDates.value.length) ElMessage.info("区间内没有匹配的生成日期");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "日期计算失败");
  } finally {
    generateBusy.value = false;
  }
}
async function checkCron() {
  if (!generateForm.cronExpr.trim()) {
    ElMessage.error("请填写 Cron 表达式");
    return;
  }
  generateBusy.value = true;
  try {
    const matched = await waveGenerationApi.checkCron(
      generateForm.cronExpr.trim()
    );
    ElMessage.success(matched ? "表达式当前时间匹配" : "表达式当前时间不匹配");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "校验失败");
  } finally {
    generateBusy.value = false;
  }
}

function refreshAll() {
  void loadTemplates(true);
  void loadCity(true);
  void loadTemplateOptions();
}
refreshAll();
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="波次模板" name="template">
          <el-form inline @submit.prevent="loadTemplates(true)">
            <el-form-item label="模板名称"
              ><el-input
                v-model="templateQuery.templateName"
                clearable
                maxlength="64"
            /></el-form-item>
            <el-button native-type="submit" type="primary">查询</el-button>
            <el-button
              type="primary"
              plain
              class="create-btn"
              @click="createTemplate"
              >新建模板</el-button
            >
          </el-form>
          <el-table
            v-loading="templateLoading"
            :data="templates"
            row-key="templateId"
          >
            <el-table-column
              prop="templateName"
              label="模板名称"
              min-width="180"
            />
            <el-table-column label="类型" width="90"
              ><template #default="{ row }">{{
                waveTypeLabel((row as WaveTemplate).waveType)
              }}</template></el-table-column
            >
            <el-table-column label="城市编码" width="110"
              ><template #default="{ row }">{{
                (row as WaveTemplate).cityCode || "-"
              }}</template></el-table-column
            >
            <el-table-column label="站点数" width="90"
              ><template #default="{ row }">{{
                ((row as WaveTemplate).details ?? []).length
              }}</template></el-table-column
            >
            <el-table-column label="规则数" width="90"
              ><template #default="{ row }">{{
                ((row as WaveTemplate).generationRules ?? []).length
              }}</template></el-table-column
            >
            <el-table-column prop="remark" label="备注" min-width="150"
              ><template #default="{ row }">{{
                (row as WaveTemplate).remark || "-"
              }}</template></el-table-column
            >
            <el-table-column label="操作" width="150" fixed="right"
              ><template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="editTemplate(row as WaveTemplate)"
                  >编辑</el-button
                >
                <el-button
                  link
                  type="danger"
                  @click="removeTemplate(row as WaveTemplate)"
                  >删除</el-button
                >
              </template></el-table-column
            >
          </el-table>
          <el-pagination
            v-model:current-page="templateQuery.pageNum"
            :page-size="templateQuery.pageSize"
            :total="templateTotal"
            layout="total, prev, pager, next"
            @current-change="loadTemplates()"
          />
        </el-tab-pane>
        <el-tab-pane label="城市波次模板" name="city">
          <el-form inline @submit.prevent="loadCity(true)">
            <el-form-item label="模板名称"
              ><el-input
                v-model="cityQuery.templateName"
                clearable
                maxlength="64"
            /></el-form-item>
            <el-button native-type="submit" type="primary">查询</el-button>
            <el-button
              type="primary"
              plain
              class="create-btn"
              @click="createCity"
              >新建城市模板</el-button
            >
          </el-form>
          <el-table
            v-loading="cityLoading"
            :data="cityTemplates"
            row-key="templateId"
          >
            <el-table-column
              prop="templateName"
              label="模板名称"
              min-width="180"
            />
            <el-table-column label="城市编码" width="110"
              ><template #default="{ row }">{{
                (row as CityWaveTemplate).cityCode || "-"
              }}</template></el-table-column
            >
            <el-table-column label="提货仓节点数" width="110"
              ><template #default="{ row }">{{
                ((row as CityWaveTemplate).sourceNodeIds ?? []).length
              }}</template></el-table-column
            >
            <el-table-column label="前置仓节点数" width="110"
              ><template #default="{ row }">{{
                ((row as CityWaveTemplate).deliveryNodeIds ?? []).length
              }}</template></el-table-column
            >
            <el-table-column label="配送区域" width="120"
              ><template #default="{ row }">{{
                (row as CityWaveTemplate).deliveryDistrictCode || "-"
              }}</template></el-table-column
            >
            <el-table-column label="规则数" width="90"
              ><template #default="{ row }">{{
                ((row as CityWaveTemplate).generationRules ?? []).length
              }}</template></el-table-column
            >
            <el-table-column label="操作" width="150" fixed="right"
              ><template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="editCity(row as CityWaveTemplate)"
                  >编辑</el-button
                >
                <el-button
                  link
                  type="danger"
                  @click="removeCity(row as CityWaveTemplate)"
                  >删除</el-button
                >
              </template></el-table-column
            >
          </el-table>
          <el-pagination
            v-model:current-page="cityQuery.pageNum"
            :page-size="cityQuery.pageSize"
            :total="cityTotal"
            layout="total, prev, pager, next"
            @current-change="loadCity()"
          />
        </el-tab-pane>
        <el-tab-pane label="排程与生成" name="schedule">
          <el-row :gutter="16">
            <el-col :span="12">
              <div class="panel">
                <p class="section-title">波次排程</p>
                <el-form label-width="110px" :disabled="scheduleBusy">
                  <el-form-item label="波次 ID" required
                    ><el-input
                      v-model="scheduleForm.waveId"
                      maxlength="64"
                      placeholder="生成结果中的波次 ID"
                  /></el-form-item>
                  <el-form-item label="计划发车" required
                    ><el-date-picker
                      v-model="scheduleForm.planDepartTime"
                      type="datetime"
                      format="YYYY-MM-DD HH:mm:ss"
                      value-format="x"
                  /></el-form-item>
                  <el-form-item label="计划完成"
                    ><el-date-picker
                      v-model="scheduleForm.planCompleteTime"
                      type="datetime"
                      format="YYYY-MM-DD HH:mm:ss"
                      value-format="x"
                  /></el-form-item>
                  <el-form-item label="排程人"
                    ><el-input
                      v-model="scheduleForm.schedulerName"
                      maxlength="64"
                  /></el-form-item>
                  <el-form-item label="备注"
                    ><el-input v-model="scheduleForm.remark" maxlength="255"
                  /></el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="submitSchedule('create')"
                      >创建排程</el-button
                    >
                    <el-button @click="submitSchedule('update')"
                      >更新排程</el-button
                    >
                    <el-button type="danger" plain @click="cancelSchedule"
                      >取消排程</el-button
                    >
                  </el-form-item>
                </el-form>
                <p class="panel-note">
                  后端暂无排程列表查询接口；排程针对已生成的波次，ID
                  来自生成结果。
                </p>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="panel">
                <p class="section-title">波次生成</p>
                <el-form label-width="110px" :disabled="generateBusy">
                  <el-form-item>
                    <el-button type="primary" @click="generateQuick('today')"
                      >今日生成</el-button
                    >
                    <el-button @click="generateQuick('tomorrow')"
                      >明日生成</el-button
                    >
                  </el-form-item>
                  <el-form-item label="波次模板"
                    ><el-select
                      v-model="generateForm.templateId"
                      filterable
                      style="width: 100%"
                      ><el-option
                        v-for="template in templateOptions"
                        :key="template.templateId"
                        :value="template.templateId"
                        :label="template.templateName" /></el-select
                  ></el-form-item>
                  <el-form-item label="目标日期" required
                    ><el-date-picker
                      v-model="generateForm.targetDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                  /></el-form-item>
                  <el-form-item label="结束日期"
                    ><el-date-picker
                      v-model="generateForm.endDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                  /></el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="generateRange"
                      >按模板生成</el-button
                    >
                  </el-form-item>
                  <el-form-item label="规则 ID"
                    ><el-input v-model="generateForm.ruleId" maxlength="64"
                  /></el-form-item>
                  <el-form-item>
                    <el-button @click="generateManual"
                      >按规则手动生成</el-button
                    >
                    <el-button @click="calculateDates">计算生成日期</el-button>
                  </el-form-item>
                  <el-form-item label="Cron 校验"
                    ><el-input v-model="generateForm.cronExpr" maxlength="64"
                  /></el-form-item>
                  <el-form-item>
                    <el-button @click="checkCron">校验表达式</el-button>
                  </el-form-item>
                </el-form>
                <p v-if="calcDates.length" class="panel-note">
                  计划生成日期：{{ calcDates.join("、") }}
                </p>
              </div>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <WaveTemplateEditDialog
      v-model="templateEditing"
      :template="templateSelected"
      @saved="loadTemplates()"
    />
    <CityWaveEditDialog
      v-model="cityEditing"
      :template="citySelected"
      @saved="loadCity()"
    />
  </div>
</template>

<style scoped>
.section-title {
  padding-left: 8px;
  margin: 4px 0 14px;
  font-weight: 600;
  line-height: 1.3;
  border-left: 3px solid var(--el-color-primary);
}

.create-btn {
  margin-left: 12px;
}

.panel {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.panel-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
