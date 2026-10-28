<script setup lang="ts">
import { ref, nextTick, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import ReQrcode from "@/components/ReQrcode";
import ReBarcode from "@/components/ReBarcode";
import Print from "@/utils/print";

export interface WarehouseLabel {
  code: string;
  title: string;
  subtitle: string;
  lines?: string[];
}
const props = defineProps<{ labels: WarehouseLabel[] }>();
const visible = defineModel<boolean>({ default: false });
const sheet = ref<HTMLElement>();
const copies = shallowRef(1);
const printing = shallowRef(false);
async function print() {
  if (!sheet.value || printing.value) {
    return;
  }
  printing.value = true;
  try {
    await nextTick();
    const images = Array.from(sheet.value.querySelectorAll("img"));
    if (images.some(image => !image.complete || image.naturalWidth === 0)) {
      throw new Error("标签二维码尚未生成，请稍后再打印");
    }
    Print(sheet.value, {
      styleStr:
        ".wms-label{width:100mm;min-height:55mm;border:1px solid #333;padding:5mm;box-sizing:border-box;break-inside:avoid;margin-bottom:4mm;color:#000;background:#fff}.label-codes{display:flex;align-items:center;justify-content:space-between}.label-codes img{width:24mm;height:24mm}.label-codes svg{max-width:65mm}.wms-label h3,.wms-label p{margin:2mm 0;font-size:12pt}.wms-label small{font-size:10pt}@page{margin:8mm;}"
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "打印失败");
  } finally {
    printing.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    title="标签预览与打印"
    width="650px"
    destroy-on-close
  >
    <p>
      码值与扫码作业一致。打印窗口中选择打印机、纸张与缩放；可先保存 PDF
      核对尺寸。
    </p>
    <el-form inline
      ><el-form-item label="每张份数"
        ><el-input-number v-model="copies" :min="1" :max="20" /></el-form-item
    ></el-form>
    <div ref="sheet">
      <template v-for="label in props.labels" :key="label.code">
        <article
          v-for="copy in copies"
          :key="`${label.code}-${copy}`"
          class="wms-label"
        >
          <h3>{{ label.title }}</h3>
          <p>{{ label.subtitle }}</p>
          <div class="label-codes">
            <ReBarcode
              :key="label.code"
              tag="svg"
              :text="label.code"
              :options="{ height: 45, width: 1.2, fontSize: 12, margin: 4 }"
            />
            <ReQrcode
              :key="`qr-${label.code}`"
              tag="img"
              :width="100"
              :text="label.code"
              :options="{ width: 100, margin: 1 }"
            />
          </div>
          <p v-for="line in label.lines" :key="line">
            <small>{{ line }}</small>
          </p>
        </article>
      </template>
    </div>
    <template #footer
      ><el-button @click="visible = false">关闭</el-button
      ><el-button
        type="primary"
        :disabled="!labels.length"
        :loading="printing"
        @click="print"
        >打印标签</el-button
      ></template
    >
  </el-dialog>
</template>
<style scoped>
.wms-label {
  padding: 20px;
  margin: 12px 0;
  color: #111;
  background: white;
  border: 1px dashed #888;
  break-inside: avoid;
}

.label-codes {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.label-codes :deep(svg) {
  max-width: 75%;
  height: auto;
}

.wms-label p {
  margin: 6px 0;
}
</style>
