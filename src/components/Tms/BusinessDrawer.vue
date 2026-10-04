<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; size?: string; loading?: boolean }>(),
  { size: "720px" }
);
const open = defineModel<boolean>({ required: true });
</script>
<template>
  <el-drawer v-model="open" :title="title" :size="size" destroy-on-close>
    <div v-loading="loading"><slot /></div>
    <template #footer
      ><slot name="footer"
        ><el-button @click="open = false">关闭</el-button></slot
      ></template
    >
  </el-drawer>
</template>
