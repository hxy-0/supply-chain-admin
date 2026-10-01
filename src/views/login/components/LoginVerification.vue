<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { FormInstance, FormRules } from "element-plus";
import Motion from "../utils/motion";
import { accountRule } from "../utils/rule";
import { authRequest, completeLogin } from "../utils/authentication";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import User from "~icons/ri/user-3-fill";
import Lock from "~icons/ri/lock-fill";
import Keyhole from "~icons/ri/shield-keyhole-line";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

const props = withDefaults(
  defineProps<{ mode?: "login" | "register" | "reset" }>(),
  { mode: "login" }
);
const { t } = useI18n();
const form = reactive({
  account: "",
  code: "",
  password: "",
  repeatPassword: ""
});
const formRef = ref<FormInstance>();
const loading = ref(false);
const sending = ref(false);
const seconds = ref(0);
let timer: ReturnType<typeof setInterval>;
const needsPassword = computed(() => props.mode !== "login");
const rules: FormRules = {
  account: [accountRule],
  code: [
    {
      pattern: /^\d{6}$/,
      required: true,
      message: t("login.pureVerifyCodeSixReg"),
      trigger: "blur"
    }
  ],
  password: [
    {
      validator: (_rule, value, done) => {
        if (value.length < 8 || new TextEncoder().encode(value).length > 72)
          done(new Error(t("login.purePasswordLength")));
        else done();
      },
      trigger: "blur"
    }
  ],
  repeatPassword: [
    {
      validator: (_rule, value, done) => {
        if (!value || value !== form.password)
          done(new Error(t("login.purePassWordDifferentReg")));
        else done();
      },
      trigger: "blur"
    }
  ]
};
const label = computed(() =>
  t(
    props.mode === "login"
      ? "login.pureLogin"
      : props.mode === "register"
        ? "login.pureRegister"
        : "login.pureDefinite"
  )
);
async function send() {
  if (sending.value || seconds.value) return;
  if (!(await formRef.value?.validateField("account").catch(() => false)))
    return;
  sending.value = true;
  try {
    await authRequest<void>("/code", {
      account: form.account,
      purpose: props.mode
    });
    message(t("login.pureCodeSent"), { type: "success" });
    seconds.value = 60;
    timer = setInterval(() => {
      if (--seconds.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (error) {
    message(error.message, { type: "error" });
  } finally {
    sending.value = false;
  }
}
async function submit() {
  if (loading.value || !(await formRef.value?.validate().catch(() => false)))
    return;
  loading.value = true;
  try {
    if (props.mode === "login") {
      const store = useUserStoreHook();
      await completeLogin(
        await authRequest("/code-login", {
          account: form.account,
          code: form.code,
          rememberDays: store.isRemembered ? store.loginDay : 1
        })
      );
    } else {
      await authRequest(
        props.mode === "register" ? "/register" : "/reset-password",
        { account: form.account, code: form.code, password: form.password }
      );
      message(
        t(
          props.mode === "register"
            ? "login.pureRegisterSuccess"
            : "login.pureResetSuccess"
        ),
        { type: "success" }
      );
      useUserStoreHook().SET_CURRENTPAGE(0);
    }
  } catch (error) {
    message(error.message, { type: "error" });
  } finally {
    loading.value = false;
  }
}
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    size="large"
    @submit.prevent="submit"
  >
    <Motion>
      <el-form-item prop="account">
        <el-input
          v-model="form.account"
          clearable
          autocomplete="username"
          :placeholder="t('login.pureAccount')"
          :prefix-icon="useRenderIcon(User)"
        />
      </el-form-item>
    </Motion>
    <Motion :delay="100">
      <el-form-item prop="code">
        <div class="w-full flex justify-between">
          <el-input
            v-model="form.code"
            clearable
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
            :placeholder="t('login.pureVerifyCode')"
            :prefix-icon="useRenderIcon(Keyhole)"
          />
          <el-button
            class="ml-2!"
            :loading="sending"
            :disabled="seconds > 0"
            @click="send"
            >{{
              seconds > 0 ? `${seconds}s` : t("login.pureGetVerifyCode")
            }}</el-button
          >
        </div>
      </el-form-item>
    </Motion>
    <Motion v-if="needsPassword" :delay="150">
      <el-form-item prop="password">
        <el-input
          v-model="form.password"
          show-password
          autocomplete="new-password"
          :placeholder="t('login.purePassword')"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
      <el-form-item prop="repeatPassword">
        <el-input
          v-model="form.repeatPassword"
          show-password
          autocomplete="new-password"
          :placeholder="t('login.pureSure')"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
    </Motion>
    <Motion :delay="200">
      <el-form-item
        ><el-button
          class="w-full"
          type="primary"
          native-type="submit"
          :loading="loading"
          >{{ label }}</el-button
        ></el-form-item
      >
      <el-form-item
        ><el-button
          class="w-full"
          @click="useUserStoreHook().SET_CURRENTPAGE(0)"
          >{{ t("login.pureBack") }}</el-button
        ></el-form-item
      >
    </Motion>
  </el-form>
</template>
