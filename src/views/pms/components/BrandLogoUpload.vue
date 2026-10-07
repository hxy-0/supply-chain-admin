<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import {
  ElMessage,
  type UploadProps,
  type UploadRequestOptions,
  type UploadUserFile
} from "element-plus";
import { uploadProductImage } from "@/api/pms";
import ZoomIn from "~icons/ep/zoom-in";
import Refresh from "~icons/ep/refresh";
import Delete from "~icons/ep/delete";
import Plus from "~icons/ep/plus";

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
  if (props.disabled || pending.value || !validate(file)) return;
  pending.value = true;
  emit("uploading", true);
  try {
    const payload =
      file.type === "image/svg+xml" ? await rasterizeSvg(file) : file;
    const url = await uploadProductImage(payload);
    model.value = url;
    fileList.value = [{ name: "品牌 Logo", url, status: "success" }];
  } catch (error) {
    fileList.value = model.value
      ? [{ name: "品牌 Logo", url: model.value, status: "success" }]
      : [];
    ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
  } finally {
    pending.value = false;
    emit("uploading", false);
  }
}
function onPreview() {
  previewUrl.value = model.value || "";
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
  if (props.disabled || pending.value) return;
  model.value = "";
  fileList.value = [];
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
    <el-upload
      v-model:file-list="fileList"
      v-loading="pending"
      list-type="picture-card"
      :show-file-list="false"
      accept="image/jpeg,image/png,image/gif,image/svg+xml"
      :limit="1"
      :disabled="disabled || pending"
      :http-request="onUpload"
      :before-upload="validate"
      :on-exceed="onExceed"
    >
      <template v-if="model">
        <img :src="model" alt="品牌 Logo" class="logo-image" />
        <span class="logo-actions">
          <button
            type="button"
            class="logo-action"
            title="预览"
            aria-label="预览 Logo"
            @click.stop="onPreview"
            @keydown.stop
          >
            <el-icon><ZoomIn /></el-icon>
          </button>
          <button
            type="button"
            class="logo-action"
            title="替换"
            aria-label="替换 Logo"
            :disabled="disabled || pending"
          >
            <el-icon><Refresh /></el-icon>
          </button>
          <button
            type="button"
            class="logo-action"
            title="删除"
            aria-label="删除 Logo"
            :disabled="disabled || pending"
            @click.stop="onRemove"
            @keydown.stop
          >
            <el-icon><Delete /></el-icon>
          </button>
        </span>
      </template>
      <el-icon v-else class="upload-plus"><Plus /></el-icon>
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
.upload-plus {
  font-size: 28px;
  color: var(--el-text-color-secondary);
}

:deep(.el-upload--picture-card) {
  position: relative;
  width: 178px;
  height: 178px;
  overflow: hidden;
  background: var(--el-bg-color);
}

/* 长方形 Logo 在方形卡片内完整显示，不裁剪不拉伸 */
.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-actions {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 50%);
  opacity: 0;
  transition: opacity 0.2s;
}

:deep(.el-upload--picture-card:hover) .logo-actions,
:deep(.el-upload--picture-card:focus-within) .logo-actions {
  opacity: 1;
}

.logo-action {
  display: inline-flex;
  padding: 0;
  font-size: 18px;
  color: #fff;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.logo-action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.logo-action:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

@media (hover: none) {
  .logo-actions {
    opacity: 1;
  }
}

.preview-image {
  display: block;
  width: 100%;
  object-fit: contain;
}
</style>
