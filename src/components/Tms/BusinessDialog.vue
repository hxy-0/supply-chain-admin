<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    width?: string;
    busy?: boolean;
    submitText?: string;
    readonly?: boolean;
  }>(),
  { width: "760px", submitText: "保存" }
);
const open = defineModel<boolean>({ required: true });
defineEmits<{ submit: []; closed: [] }>();
</script>
<template>
  <el-dialog
    v-model="open"
    :title="title"
    :width="width"
    style="max-width: calc(100vw - 32px)"
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @closed="$emit('closed')"
  >
    <slot />
    <template #footer>
      <slot name="footer">
        <el-button :disabled="busy" @click="open = false">{{
          readonly ? "关闭" : "取消"
        }}</el-button>
        <el-button
          v-if="!readonly"
          type="primary"
          :loading="busy"
          @click="$emit('submit')"
          >{{ submitText }}</el-button
        >
      </slot>
    </template>
  </el-dialog>
</template>
