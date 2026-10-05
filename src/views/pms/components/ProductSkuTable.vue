<script setup lang="ts">
import { ref } from "vue";
import type { ProductCommand } from "@/api/pms";
import SkuFields from "./SkuFields.vue";
import SkuImages from "./SkuImages.vue";
const skus = defineModel<ProductCommand["skus"]>({ required: true });
defineProps<{ disabled?: boolean }>();
const selected = ref<ProductCommand["skus"][number]>();
const visible = ref(false);
function edit(row: ProductCommand["skus"][number]) {
  selected.value = row;
  visible.value = true;
}
function defaultSku(index: number) {
  skus.value.forEach((sku, i) => (sku.isDefault = i === index));
}
</script>
<template>
  <div>
    <el-table :data="skus" row-key="specSignature"
      ><el-table-column
        prop="specText"
        label="规格"
        min-width="160"
      /><el-table-column label="SKU 编码" min-width="140"
        ><template #default="{ row }"
          ><el-input
            v-model="row.skuCode"
            maxlength="64"
            :disabled="disabled" /></template></el-table-column
      ><el-table-column label="零售价" width="180"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.retailPrice"
            :min="0"
            :precision="4"
            :disabled="disabled" /></template></el-table-column
      ><el-table-column label="状态" width="95"
        ><template #default="{ row }"
          ><el-select v-model="row.isEnable" :disabled="disabled"
            ><el-option label="启用" :value="1" /><el-option
              label="停用"
              :value="0" /></el-select></template></el-table-column
      ><el-table-column label="默认" width="70"
        ><template #default="{ row, $index }"
          ><el-radio
            :model-value="!!row.isDefault"
            :value="true"
            :disabled="disabled"
            @change="defaultSku($index)"
            ><span /></el-radio></template></el-table-column
      ><el-table-column width="105"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            :disabled="disabled"
            @click="edit(row as ProductCommand['skus'][number])"
            >详细资料</el-button
          ></template
        ></el-table-column
      ></el-table
    ><el-dialog
      v-model="visible"
      title="SKU 详细资料"
      width="min(800px,95vw)"
      append-to-body
      :close-on-click-modal="false"
      ><el-form v-if="selected" :model="selected" label-width="100px"
        ><SkuFields v-model:sku="selected" :disabled="disabled" /><el-divider
          >规格图片</el-divider
        ><SkuImages v-model="selected.images" :disabled="disabled" /></el-form
      ><template #footer
        ><el-button @click="visible = false">完成</el-button></template
      ></el-dialog
    >
  </div>
</template>
