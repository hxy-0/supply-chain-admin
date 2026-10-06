<script setup lang="ts">
import { ref, watch } from "vue";
import {
  ElMessage,
  type UploadProps,
  type UploadUserFile,
  type UploadRequestOptions
} from "element-plus";
import { uploadProductImage, type ProductCommand } from "@/api/pms";
import ProductImageManager from "./ProductImageManager.vue";
const model = defineModel<ProductCommand["images"]>({ required: true });
const mainImageUrl = defineModel<string>("mainImageUrl");
defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ uploading: [value: boolean] }>();
const fileList = ref<UploadUserFile[]>([]);
const pending = ref(0);
const previewVisible = ref(false);
const previewUrl = ref("");
const managerVisible = ref(false);
watch(
  model,
  images => {
    if (pending.value) return;
    fileList.value = images.map((image, index) => ({
      name: `商品图片 ${index + 1}`,
      url: image.imageUrl,
      status: "success"
    }));
    mainImageUrl.value = images[0]?.imageUrl || "";
  },
  { immediate: true, deep: true }
);
function sync() {
  const existing = new Map(model.value.map(image => [image.imageUrl, image]));
  model.value = fileList.value
    .filter(file => file.status === "success" && file.url)
    .map((file, index) => ({
      ...existing.get(file.url!),
      imageUrl: file.url!,
      imageType: existing.get(file.url!)?.imageType ?? 1,
      sortOrder: index
    }));
  mainImageUrl.value = model.value[0]?.imageUrl || "";
}
const beforeUpload: UploadProps["beforeUpload"] = file => {
  if (
    !["image/jpeg", "image/png", "image/gif"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    ElMessage.warning("请上传 5MB 以内的 JPG、PNG 或 GIF 图片");
    return false;
  }
  return true;
};
async function upload(options: UploadRequestOptions) {
  pending.value++;
  emit("uploading", true);
  try {
    const url = await uploadProductImage(options.file);
    const file = fileList.value.find(item => item.uid === options.file.uid);
    if (file) {
      file.url = url;
      file.status = "success";
    }
    sync();
    return { url };
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
    throw error;
  } finally {
    pending.value--;
    emit("uploading", pending.value > 0);
  }
}
const preview: UploadProps["onPreview"] = file => {
  previewUrl.value = file.url || "";
  previewVisible.value = true;
};
</script>
<template>
  <div>
    <p class="image-tip">支持多选上传，第一张为默认图。</p>
    <el-upload
      v-model:file-list="fileList"
      list-type="picture-card"
      multiple
      accept="image/jpeg,image/png,image/gif"
      :limit="100"
      :disabled="disabled || pending > 0"
      :http-request="upload"
      :before-upload="beforeUpload"
      :on-preview="preview"
      :on-remove="sync"
      :on-exceed="() => ElMessage.warning('最多上传 100 张图片')"
    >
      <span class="upload-plus">+</span>
    </el-upload>
    <el-button
      v-if="model.length && !disabled"
      class="manage-button"
      :disabled="pending > 0"
      @click="managerVisible = true"
      >管理图片</el-button
    >
    <el-dialog
      v-model="previewVisible"
      title="图片预览"
      append-to-body
      width="min(800px, 90vw)"
      ><img :src="previewUrl" alt="商品图片" class="preview-image"
    /></el-dialog>
    <ProductImageManager v-model="managerVisible" v-model:images="model" />
  </div>
</template>
<style scoped>
.image-tip {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
}
.upload-plus {
  font-size: 28px;
  color: var(--el-text-color-secondary);
}
.manage-button {
  margin-top: 12px;
}
.preview-image {
  display: block;
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
:deep(.el-upload--picture-card),
:deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: 104px;
  height: 104px;
}
</style>
