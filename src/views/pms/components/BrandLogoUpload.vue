<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import {
  ElMessage,
  type UploadProps,
  type UploadRequestOptions,
  type UploadUserFile
} from "element-plus";
import { uploadProductImage } from "@/api/pms";

const model = defineModel<string>();
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ uploading: [value: boolean] }>();

const fileList = ref<UploadUserFile[]>([]);
const pending = ref(false);
const previewVisible = ref(false);
const previewUrl = ref("");
watch(
  model,
  url => {
    if (pending.value) return;
    fileList.value = url ? [{ name: "品牌 Logo", url, status: "success" }] : [];
  },
  { immediate: true }
);
function validate(file: File) {
  if (
    !["image/jpeg", "image/png", "image/gif", "image/svg+xml"].includes(
      file.type
    ) ||
    file.size > 5 * 1024 * 1024
  ) {
    ElMessage.warning("请上传 5MB 以内的 JPG、PNG、GIF 或 SVG 图片");
    return false;
  }
  return true;
}
// 后端只存转码后的 PNG（内联 SVG 有脚本风险），SVG 在浏览器端栅格化后上传；
// 在 <img> 上下文里 SVG 内的脚本不会执行，栅格化是安全的。
async function rasterizeSvg(file: File): Promise<File> {
  const doc = new DOMParser().parseFromString(
    await file.text(),
    "image/svg+xml"
  );
  const root = doc.querySelector("svg");
  if (!root || doc.querySelector("parsererror")) {
    throw new Error("SVG 文件解析失败");
  }
  const viewBox = (root.getAttribute("viewBox") || "")
    .split(/[\s,]+/)
    .map(Number);
  const px = (value: string | null) =>
    value && /^[\d.]+(px)?$/i.test(value.trim()) ? parseFloat(value) : 0;
  let width = px(root.getAttribute("width"));
  let height = px(root.getAttribute("height"));
  if (
    (!width || !height) &&
    viewBox.length === 4 &&
    viewBox[2] > 0 &&
    viewBox[3] > 0
  ) {
    width = viewBox[2];
    height = viewBox[3];
  }
  if (!width || !height) {
    width = 1;
    height = 1;
  }
  const scale = 512 / Math.max(width, height);
  const canvasWidth = Math.max(1, Math.round(width * scale));
  const canvasHeight = Math.max(1, Math.round(height * scale));
  // 只有 viewBox 没有固有宽高的 SVG，部分浏览器画不到 canvas，先补显式宽高。
  root.setAttribute("width", String(canvasWidth));
  root.setAttribute("height", String(canvasHeight));
  const blob = new Blob([new XMLSerializer().serializeToString(root)], {
    type: "image/svg+xml"
  });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG 文件解析失败"));
      image.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持图片处理");
    context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    const png = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!png) throw new Error("SVG 转 PNG 失败");
    const name = `${file.name.replace(/\.svg$/i, "")}.png`;
    return new File([png], name, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
async function upload(file: File) {
  if (!validate(file)) return;
  pending.value = true;
  emit("uploading", true);
  try {
    const payload =
      file.type === "image/svg+xml" ? await rasterizeSvg(file) : file;
    const url = await uploadProductImage(payload);
    model.value = url;
    fileList.value = [{ name: "品牌 Logo", url, status: "success" }];
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
  } finally {
    pending.value = false;
    emit("uploading", false);
  }
}
function onPreview(file: UploadUserFile) {
  previewUrl.value = file.url || "";
  previewVisible.value = true;
}
async function onUpload(options: UploadRequestOptions) {
  await upload(options.file);
}
// 只允许一张：已有 Logo 时再次选择文件，直接替换。
const onExceed: UploadProps["onExceed"] = files => {
  const file = files[0];
  if (file) void upload(file);
};
function onRemove() {
  model.value = "";
}
// 粘贴上传：剪贴板里有图片时直接覆盖当前 Logo。
function onPaste(event: ClipboardEvent) {
  if (props.disabled || pending.value) return;
  const file = Array.from(event.clipboardData?.items || [])
    .find(item => item.type.startsWith("image/"))
    ?.getAsFile();
  if (!file) return;
  event.preventDefault();
  void upload(file);
}
document.addEventListener("paste", onPaste);
onBeforeUnmount(() => document.removeEventListener("paste", onPaste));
</script>
<template>
  <div>
    <p class="logo-tip">上传图片</p>
    <el-upload
      v-model:file-list="fileList"
      list-type="picture-card"
      accept="image/jpeg,image/png,image/gif,image/svg+xml"
      :limit="1"
      :disabled="disabled || pending"
      :http-request="onUpload"
      :before-upload="validate"
      :on-preview="onPreview"
      :on-remove="onRemove"
      :on-exceed="onExceed"
    >
      <span class="upload-plus">+</span>
    </el-upload>
    <el-dialog
      v-model="previewVisible"
      title="Logo 预览"
      append-to-body
      width="min(480px, 90vw)"
      ><img :src="previewUrl" alt="品牌 Logo" class="preview-image"
    /></el-dialog>
  </div>
</template>
<style scoped>
.logo-tip {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
}
.upload-plus {
  font-size: 28px;
  color: var(--el-text-color-secondary);
}
:deep(.el-upload--picture-card),
:deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: 80px;
  height: 80px;
}
/* 长方形 Logo 在方形卡片内完整显示，不裁剪不拉伸 */
:deep(.el-upload-list__item-thumbnail) {
  object-fit: contain;
}
.preview-image {
  display: block;
  width: 100%;
  object-fit: contain;
}
</style>
