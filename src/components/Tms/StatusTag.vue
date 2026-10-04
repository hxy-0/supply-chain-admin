<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ value?: number; config?: boolean }>();
const state = computed(() =>
  props.config
    ? props.value === 0
      ? ["停用", "info"]
      : ["启用", "success"]
    : {
        10: ["排队中", "info"],
        20: ["叫号中", "warning"],
        30: ["使用中", "primary"],
        40: ["已完成", "success"],
        50: ["已取消", "danger"]
      }[props.value] || ["未知", "info"]
);
</script>
<template>
  <el-tag :type="state[1] as any">{{ state[0] }}</el-tag>
</template>
