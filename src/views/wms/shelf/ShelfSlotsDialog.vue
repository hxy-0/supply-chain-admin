<script setup lang="ts">
import { computed } from "vue";
import { slotCodes, type Shelf } from "@/api/wmsShelf";

const props = defineProps<{ shelf?: Shelf }>();
const visible = defineModel<boolean>({ default: false });
function close() {
  visible.value = false;
}
const codes = computed(() =>
  props.shelf
    ? slotCodes(
        props.shelf.code,
        props.shelf.shelfLevel,
        props.shelf.shelfColumn
      )
    : []
);
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="`仓位预览：${shelf?.code || ''}（${shelf?.shelfLevel || 0} 层 × ${shelf?.shelfColumn || 0} 列，共 ${codes.length} 仓位）`"
    width="560px"
  >
    <div class="shelf-slots">
      <span v-for="slotCode in codes" :key="slotCode" class="shelf-slot">{{
        slotCode
      }}</span>
    </div>
    <p class="shelf-slots-note">
      仓位编号由系统按编码前缀 + 层号 + 列号自动生成。
    </p>
    <template #footer><el-button @click="close">关闭</el-button></template>
  </el-dialog>
</template>
<style scoped>
.shelf-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-height: 320px;
  overflow: auto;
}

.shelf-slot {
  font-size: 12px;
  line-height: 26px;
  text-align: center;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.shelf-slots-note {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
