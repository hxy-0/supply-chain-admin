<script setup lang="ts">
import type { Sku } from "@/api/pms";
const sku = defineModel<Sku>("sku", { required: true });
defineProps<{
  disabled?: boolean;
  prefix?: string;
}>();
const dimensions = [
  { key: "weightKg", label: "重量 (kg)" },
  { key: "lengthCm", label: "长 (cm)" },
  { key: "widthCm", label: "宽 (cm)" },
  { key: "heightCm", label: "高 (cm)" }
] as const;
</script>
<template>
  <el-row :gutter="20"
    ><el-col :span="12"
      ><el-form-item label="SKU 编码"
        ><el-input :model-value="sku.skuCode" readonly /></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="条码"
        ><el-input
          v-model="sku.barcode"
          maxlength="64"
          :disabled="disabled" /></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="SKU 名称"
        ><el-input
          v-model="sku.name"
          maxlength="255"
          :disabled="disabled" /></el-form-item></el-col
    ><el-col v-for="field in dimensions" :key="field.key" :span="12"
      ><el-form-item :label="field.label"
        ><el-input-number
          v-model="sku[field.key]"
          :min="0"
          :precision="4"
          :disabled="disabled" /></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="状态"
        ><el-radio-group v-model="sku.isEnable" :disabled="disabled"
          ><el-radio :value="1">启用</el-radio
          ><el-radio :value="0">停用</el-radio></el-radio-group
        ></el-form-item
      ></el-col
    ></el-row
  >
</template>
