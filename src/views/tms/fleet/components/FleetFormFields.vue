<script setup lang="ts">
import type { FleetField } from "../definitions";
defineProps<{
  fields: FleetField[];
  carriers?: { id: string; name: string }[];
}>();
const form = defineModel<Record<string, any>>({ required: true });
</script>
<template>
  <el-row :gutter="16">
    <el-col v-for="field in fields" :key="field.key" :xs="24" :sm="12">
      <el-form-item
        :label="field.label"
        :prop="field.key"
        :rules="
          field.required
            ? [
                {
                  required: true,
                  message: `请填写${field.label}`,
                  trigger: 'blur',
                  ...(field.kind ? {} : { whitespace: true })
                }
              ]
            : []
        "
      >
        <el-select
          v-if="field.key === 'carrierId'"
          v-model="form[field.key]"
          filterable
          clearable
          ><el-option
            v-for="c in carriers"
            :key="c.id"
            :value="c.id"
            :label="c.name"
        /></el-select>
        <el-select v-else-if="field.kind === 'select'" v-model="form[field.key]"
          ><el-option
            v-for="o in field.options"
            :key="o.value"
            :value="o.value"
            :label="o.label"
        /></el-select>
        <el-input-number
          v-else-if="field.kind === 'number'"
          v-model="form[field.key]"
          :min="field.min"
          :max="field.max"
          :precision="
            field.key === 'longitude' || field.key === 'latitude' ? 6 : 2
          "
          style="width: 100%"
        />
        <el-date-picker
          v-else-if="field.kind === 'date'"
          v-model="form[field.key]"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
        <el-input
          v-else
          v-model="form[field.key]"
          :placeholder="`请输入${field.label}`"
        />
      </el-form-item>
    </el-col>
  </el-row>
</template>
