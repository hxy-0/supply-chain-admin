<script setup lang="ts">
import { computed } from "vue";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({
  name: "PermissionPage"
});

const userStore = useUserStoreHook();
const roleText = computed(() => userStore.roles.join("、") || "暂无角色");
const permissionText = computed(
  () => userStore.permissions.join("、") || "暂无按钮权限"
);
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span class="font-medium">当前登录账号的权限信息</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="账号">{{ userStore.username || "-" }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ userStore.nickname || "-" }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ roleText }}</el-descriptions-item>
        <el-descriptions-item label="按钮权限">{{ permissionText }}</el-descriptions-item>
      </el-descriptions>
      <el-alert class="mt-4" type="info" :closable="false" title="菜单和按钮权限由后端按当前登录账号返回；本页不再使用演示账号重新登录。" />
    </el-card>
  </div>
</template>
