<script setup lang="ts">
import SupplyChainLogo from "@/assets/svg/sustainable-supply-chain.svg?component";

const logoUrl = `${import.meta.env.BASE_URL}media/supply-chain-logo.png`;

withDefaults(defineProps<{ size?: number; original?: boolean }>(), {
  size: 32,
  original: false
});
</script>

<template>
  <SupplyChainLogo
    v-if="!original"
    class="app-logo"
    role="img"
    aria-label="供应链 Logo"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <img
    v-else
    :src="logoUrl"
    class="app-logo"
    alt="供应链 Logo"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.app-logo {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  object-fit: contain;
}
</style>
