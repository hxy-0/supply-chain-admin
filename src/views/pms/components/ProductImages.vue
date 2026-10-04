<script setup lang="ts">
import type { ProductCommand } from "@/api/pms";
const model = defineModel<ProductCommand["images"]>({ required: true });
defineProps<{ disabled?: boolean }>();
</script>
<template>
  <div>
    <el-table :data="model"
      ><el-table-column label="图片地址" min-width="260"
        ><template #default="{ row }"
          ><el-input
            v-model="row.imageUrl"
            maxlength="1000"
            :disabled="disabled"
            placeholder="https://…" /></template></el-table-column
      ><el-table-column label="类型" width="140"
        ><template #default="{ row }"
          ><el-select v-model="row.imageType" :disabled="disabled"
            ><el-option label="商品图" :value="1" /><el-option
              label="详情图"
              :value="2" /></el-select></template></el-table-column
      ><el-table-column label="排序" width="130"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.sortOrder"
            :min="0"
            :precision="0"
            :disabled="disabled"
            style="width: 110px" /></template></el-table-column
      ><el-table-column v-if="!disabled" width="70"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="model.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      ></el-table
    ><el-button
      v-if="!disabled"
      @click="
        model.push({ imageUrl: '', imageType: 1, sortOrder: model.length })
      "
      >添加图片</el-button
    >
  </div>
</template>
