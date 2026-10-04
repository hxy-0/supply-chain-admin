<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { consumeGithubCallback } from "@/oauth/githubCallback";
import { authRequest, completeLogin } from "@/views/login/utils/authentication";
import { message } from "@/utils/message";

defineOptions({
  name: "OAuthCallback"
});

const router = useRouter();
const loading = ref(true);
const errorText = ref("");

/** 授权码回调中转：地址栏参数已在路由初始化前清除，这里只负责换令牌并进入首页。 */
onMounted(async () => {
  const callback = consumeGithubCallback();
  if (!callback) {
    router.replace("/login");
    return;
  }
  const providerName = callback.provider === "feishu" ? "飞书" : "GitHub";
  try {
    if (callback.error) {
      throw new Error(`${providerName} 授权已取消或失败，请重试`);
    }
    if (!callback.code || !callback.state) {
      throw new Error(`${providerName} 授权回调无效，请重新登录`);
    }
    await completeLogin(
      await authRequest(`/${callback.provider}/callback`, {
        code: callback.code,
        state: callback.state
      })
    );
  } catch (error) {
    errorText.value = error.message;
    message(error.message, { type: "error" });
    await router.replace("/login");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="h-screen w-screen flex-c flex-col gap-3 select-none">
    <span
      v-if="loading"
      class="size-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
    />
    <p
      v-if="loading || errorText"
      class="text-sm text-slate-500"
      role="status"
      aria-live="polite"
    >
      {{ loading ? "正在登录，请稍候…" : errorText }}
    </p>
  </div>
</template>
