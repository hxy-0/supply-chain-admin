<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import { authRequest } from "../utils/authentication";
import {
  getFeishuQrRedirect,
  loadFeishuQrSdk,
  parseFeishuQrAuthorizationUrl
} from "../utils/feishuQr";

const emit = defineEmits<{ back: [] }>();
const { t } = useI18n();
const containerId = `feishu-qr-${useId()}`;
const container = ref<HTMLDivElement>();
const status = ref<"loading" | "ready" | "redirecting" | "error">("loading");
const errorText = ref("");
let generation = 0;
let removeListener: (() => void) | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let loadTimer: ReturnType<typeof setTimeout> | undefined;

function cleanup() {
  removeListener?.();
  removeListener = undefined;
  clearTimeout(expiryTimer);
  clearTimeout(loadTimer);
  const iframe = container.value?.querySelector("iframe");
  if (iframe) {
    iframe.onload = null;
    iframe.onerror = null;
  }
  container.value?.replaceChildren();
}

async function refresh() {
  const current = ++generation;
  cleanup();
  status.value = "loading";
  errorText.value = "";
  try {
    const factory = await loadFeishuQrSdk();
    if (current !== generation) return;
    const { authorizationUrl } = await authRequest<{
      authorizationUrl: string;
    }>("/feishu/authorize");
    if (current !== generation || !container.value) return;
    const goto = parseFeishuQrAuthorizationUrl(authorizationUrl).toString();
    const instance = factory({
      id: containerId,
      goto,
      width: "300",
      height: "300",
      style: "width:300px;height:300px;border:0;max-width:100%;"
    });
    const iframe = container.value.querySelector("iframe");
    if (!iframe) throw new Error("QR iframe missing");
    iframe.title = t("login.pureFeishuQrTitle");
    const fail = (text: string) => {
      if (current !== generation) return;
      cleanup();
      errorText.value = text;
      status.value = "error";
    };
    loadTimer = setTimeout(
      () => fail(t("login.pureFeishuQrLoadFailed")),
      15_000
    );
    iframe.onload = () => {
      if (current !== generation) return;
      clearTimeout(loadTimer);
      status.value = "ready";
    };
    iframe.onerror = () => fail(t("login.pureFeishuQrLoadFailed"));
    const handleMessage = (event: MessageEvent) => {
      if (current !== generation || status.value === "redirecting") return;
      const redirect = getFeishuQrRedirect(
        event,
        instance,
        iframe.contentWindow,
        goto
      );
      if (!redirect) return;
      status.value = "redirecting";
      cleanup();
      window.location.assign(redirect);
    };
    window.addEventListener("message", handleMessage);
    removeListener = () => window.removeEventListener("message", handleMessage);
    // 比后端 10 分钟 state 有效期稍短；过期后需重新申请浏览器绑定会话。
    expiryTimer = setTimeout(
      () => fail(t("login.pureFeishuQrExpired")),
      9 * 60_000
    );
  } catch {
    if (current !== generation) return;
    cleanup();
    errorText.value = t("login.pureFeishuQrLoadFailed");
    status.value = "error";
  }
}

onMounted(refresh);
onBeforeUnmount(() => {
  generation++;
  cleanup();
});
</script>

<template>
  <section class="feishu-qr-login" :aria-label="t('login.pureFeishuQrTitle')">
    <h3>{{ t("login.pureFeishuQrTitle") }}</h3>
    <p class="qr-hint">{{ t("login.pureFeishuQrHint") }}</p>
    <div class="qr-panel" :aria-busy="status === 'loading'">
      <div :id="containerId" ref="container" class="qr-container" />
      <div v-if="status !== 'ready'" class="qr-status" aria-live="polite">
        <p v-if="status === 'error'" role="alert">{{ errorText }}</p>
        <p v-else-if="status === 'redirecting'">
          {{ t("login.pureFeishuQrRedirecting") }}
        </p>
        <p v-else>{{ t("login.pureFeishuQrLoading") }}</p>
      </div>
    </div>
    <div class="qr-actions">
      <el-button
        link
        type="primary"
        :disabled="status === 'loading' || status === 'redirecting'"
        @click="refresh"
      >
        {{ t("login.pureFeishuQrRefresh") }}
      </el-button>
      <el-button
        link
        :disabled="status === 'redirecting'"
        @click="emit('back')"
      >
        {{ t("login.pureFeishuQrBack") }}
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.feishu-qr-login h3 {
  margin: 20px 0 8px;
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.qr-hint {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.qr-panel {
  position: relative;
  width: 300px;
  max-width: 100%;
  height: 300px;
  margin: 0 auto;
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
}

.qr-container {
  width: 100%;
  height: 100%;
}

.qr-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 14px;
  line-height: 1.7;
  color: #687589;
  background: #fff;
}

.qr-actions {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin: 20px 0;
}
</style>
