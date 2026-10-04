<script setup lang="ts">
import type { SkuImage } from "@/api/pms";
const images = defineModel<SkuImage[]>({ required: true });
defineProps<{ disabled?: boolean }>();
function primary(index: number) {
  images.value.forEach((image, i) => (image.isPrimary = i === index));
}
</script>
<template>
  <div>
    <el-table :data="images"
      ><el-table-column label="图片地址" min-width="230"
        ><template #default="{ row }"
          ><el-input
            v-model="row.imageUrl"
            maxlength="1000"
            :disabled="disabled" /></template></el-table-column
      ><el-table-column label="主图" width="70"
        ><template #default="{ row, $index }"
          ><el-radio
            :model-value="!!row.isPrimary"
            :value="true"
            :disabled="disabled"
            @change="primary($index)"
            ><span /></el-radio></template></el-table-column
      ><el-table-column label="排序" width="125"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.sortOrder"
            :min="0"
            :precision="0"
            style="width: 105px"
            :disabled="disabled" /></template></el-table-column
      ><el-table-column v-if="!disabled" width="70"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="images.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      ></el-table
    ><el-button
      v-if="!disabled"
      @click="
        images.push({
          imageUrl: '',
          isPrimary: !images.length,
          sortOrder: images.length
        })
      "
      >添加图片</el-button
    >
  </div>
</template>
