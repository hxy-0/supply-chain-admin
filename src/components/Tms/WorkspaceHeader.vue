<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>

<template>
  <header class="tms-page-heading">
    <div>
      <div class="eyebrow">运输管理 · 工作空间</div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.default"><slot /></div>
  </header>
</template>
