<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import JsBarcode from "jsbarcode";

const props = defineProps<{ value?: string }>();
const image = ref("");
const failure = ref(false);
const preview = ref(false);
watch(
  () => props.value,
  async value => {
    image.value = "";
    failure.value = false;
    if (!value) return;
    await nextTick();
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, value, {
        format: "CODE128",
        height: 32,
        width: 2,
        margin: 10,
        fontSize: 14
      });
      image.value = canvas.toDataURL("image/png");
    } catch {
      failure.value = true;
    }
  },
  { immediate: true }
);
</script>

<template>
  <button
    v-if="image"
    type="button"
    class="barcode"
    :aria-label="`放大条码 ${value}`"
    @click="preview = true"
  >
    <img :src="image" :alt="value" />
  </button>
  <span v-else-if="failure">{{ value }}（无法显示条码）</span>
  <span v-else>未设置</span>
  <el-dialog v-model="preview" title="条码预览" width="720px" append-to-body>
    <div class="barcode-preview"><img :src="image" :alt="value" /></div>
  </el-dialog>
</template>

<style scoped>
.barcode {
  width: 280px;
  padding: 0;
  cursor: zoom-in;
  background: white;
  border: 0;
}

.barcode img {
  display: block;
  width: 100%;
  max-height: 64px;
  object-fit: contain;
}

.barcode-preview {
  overflow-x: auto;
  text-align: center;
}

.barcode-preview img {
  width: 100%;
  image-rendering: crisp-edges;
}
</style>
