<script setup lang="ts">
import type { WaveGenerationRule } from "@/api/tmsWave";

const rules = defineModel<WaveGenerationRule[]>({ required: true });
function addRule() {
  rules.value.push({
    ruleName: "",
    cronExpr: "",
    advanceDays: "1",
    isEnable: true
  });
}
function removeRule(index: number) {
  rules.value.splice(index, 1);
}
</script>

<template>
  <div>
    <el-table :data="rules" row-key="ruleName" size="small">
      <el-table-column label="规则名称" min-width="140"
        ><template #default="{ row }"
          ><el-input v-model="row.ruleName" maxlength="64" /></template
      ></el-table-column>
      <el-table-column label="Cron 表达式" min-width="150"
        ><template #default="{ row }"
          ><el-input v-model="row.cronExpr" maxlength="64" /></template
      ></el-table-column>
      <el-table-column label="提前天数" width="100"
        ><template #default="{ row }"
          ><el-input
            v-model="row.advanceDays"
            maxlength="2"
            aria-label="生成提前天数" /></template
      ></el-table-column>
      <el-table-column label="计划发车(分钟)" width="140"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.planDepartTime"
            :min="0"
            :max="1439"
            :precision="0"
            controls-position="right"
            aria-label="计划发车分钟数" /></template
      ></el-table-column>
      <el-table-column label="生效开始" width="150"
        ><template #default="{ row }"
          ><el-date-picker
            v-model="row.effectiveStartDate"
            type="date"
            value-format="YYYY-MM-DD"
            aria-label="生效开始日期" /></template
      ></el-table-column>
      <el-table-column label="生效结束" width="150"
        ><template #default="{ row }"
          ><el-date-picker
            v-model="row.effectiveEndDate"
            type="date"
            value-format="YYYY-MM-DD"
            aria-label="生效结束日期" /></template
      ></el-table-column>
      <el-table-column label="启用" width="70"
        ><template #default="{ row }"
          ><el-switch v-model="row.isEnable" /></template
      ></el-table-column>
      <el-table-column width="60"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="removeRule($index)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-button class="add-rule" size="small" @click="addRule"
      >添加生成规则</el-button
    >
  </div>
</template>

<style scoped>
.add-rule {
  margin-top: 8px;
}
</style>
