<script setup lang="ts">
import { ref, watch } from "vue";
import type { ProductImage } from "@/api/pms";
const visible = defineModel<boolean>({ required: true });
const images = defineModel<ProductImage[]>("images", { required: true });
const draft = ref<ProductImage[]>([]);
watch(visible, value => {
  if (value) draft.value = images.value.map(image => ({ ...image }));
});
function makeDefault(index: number) {
  draft.value.unshift(...draft.value.splice(index, 1));
}
function save() {
  images.value = draft.value.map((image, index) => ({
    ...image,
    sortOrder: index
  }));
  visible.value = false;
}
</script>
<template>
  <el-dialog
    v-model="visible"
    title="管理商品图片"
    append-to-body
    width="min(720px, 94vw)"
  >
    <p>第一张为默认图，可将其他图片设为默认或移除图片。</p>
    <el-table :data="draft">
      <el-table-column label="图片" width="100"
        ><template #default="{ row }"
          ><el-image
            :src="row.imageUrl"
            fit="cover"
            style="width: 64px; height: 64px" /></template
      ></el-table-column>
      <el-table-column label="类型"
        ><template #default="{ row }"
          ><el-select v-model="row.imageType"
            ><el-option label="商品图" :value="1" /><el-option
              label="详情图"
              :value="2" /></el-select></template
      ></el-table-column>
      <el-table-column label="操作" width="180"
        ><template #default="{ $index }"
          ><el-tag v-if="$index === 0">默认图</el-tag
          ><el-button v-else link type="primary" @click="makeDefault($index)"
            >设为默认</el-button
          ><el-button link type="danger" @click="draft.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" @click="save">确定</el-button></template
    >
  </el-dialog>
</template>
