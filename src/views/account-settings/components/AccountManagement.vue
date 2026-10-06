<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { deviceDetection } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import { authRequest } from "@/views/login/utils/authentication";
import { accountRule } from "@/views/login/utils/rule";
import { getMine } from "@/api/user";

defineOptions({ name: "AccountManagement" });
const formRef = ref<FormInstance>();
const form = reactive({
  account: "",
  code: "",
  oldPassword: "",
  password: "",
  confirmPassword: ""
});
const loading = ref(false);
const fetching = ref(false);
const sending = ref(false);
const hasPassword = ref<boolean | null>(null);
const boundAccount = ref("");
const remaining = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
const passwordTitle = computed(() =>
  hasPassword.value === null
    ? "登录密码"
    : hasPassword.value
      ? "修改密码"
      : "设置密码"
);
const passwordDialogVisible = ref(false);
const list = computed(() => [
  {
    title: passwordTitle.value,
    illustrate:
      hasPassword.value === null
        ? "正在读取密码状态"
        : hasPassword.value
          ? "验证旧密码后设置新密码"
          : "尚未设置本系统密码，验证手机号或邮箱后可设置",
    password: true
  },
  {
    title: "密保手机",
    illustrate: "已经绑定手机：158****6789",
    password: false
  },
  {
    title: "密保问题",
    illustrate: "未设置密保问题，密保问题可有效保护账户安全",
    password: false
  },
  {
    title: "备用邮箱",
    illustrate: "已绑定邮箱：pure***@163.com",
    password: false
  }
]);

async function loadPasswordStatus() {
  fetching.value = true;
  try {
    const result = await getMine();
    if (result.code !== 0) throw new Error(result.message);
    if (typeof result.data.hasPassword !== "boolean")
      throw new Error("无法读取密码状态，请稍后重试");
    hasPassword.value = result.data.hasPassword;
    boundAccount.value = result.data.username.startsWith("feishu:")
      ? ""
      : result.data.username;
    form.account = boundAccount.value;
    return true;
  } catch (error) {
    message(error.message || "读取密码状态失败，请稍后重试", { type: "error" });
    return false;
  } finally {
    fetching.value = false;
  }
}

async function onClick(item: (typeof list.value)[number]) {
  if (item.password) {
    if (fetching.value) return;
    if (await loadPasswordStatus()) passwordDialogVisible.value = true;
  } else message("请根据具体业务自行实现", { type: "success" });
}

function resetPasswordForm() {
  form.account = boundAccount.value;
  form.code = "";
  form.oldPassword = "";
  form.password = "";
  form.confirmPassword = "";
  formRef.value?.clearValidate();
}
const rules: FormRules = {
  account: [accountRule],
  code: [
    {
      required: true,
      pattern: /^\d{6}$/,
      message: "请输入6位数字验证码",
      trigger: "blur"
    }
  ],
  oldPassword: [
    { required: true, message: "请输入旧密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (new TextEncoder().encode(value).length > 72)
          callback(new Error("旧密码不能超过72字节"));
        else callback();
      },
      trigger: "blur"
    }
  ],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (value.length < 8) callback(new Error("新密码至少需要8个字符"));
        else if (new TextEncoder().encode(value).length > 72)
          callback(new Error("新密码不能超过72字节"));
        else callback();
      },
      trigger: "blur"
    }
  ],
  confirmPassword: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value) callback(new Error("请再次输入新密码"));
        else if (value !== form.password)
          callback(new Error("两次输入的密码不一致"));
        else callback();
      },
      trigger: "blur"
    }
  ]
};

async function sendCode() {
  if (loading.value || sending.value || remaining.value > 0) return;
  if (!(await formRef.value?.validateField("account").catch(() => false)))
    return;
  sending.value = true;
  try {
    await authRequest<void>("/initial-password/code", {
      account: form.account
    });
    message("验证码已发送，请查收", { type: "success" });
    remaining.value = 60;
    clearInterval(timer);
    timer = setInterval(() => {
      if (--remaining.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (error) {
    message(error.message || "验证码发送失败，请稍后重试", { type: "error" });
  } finally {
    sending.value = false;
  }
}

async function submit() {
  if (
    !formRef.value ||
    loading.value ||
    sending.value ||
    hasPassword.value === null
  )
    return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    if (hasPassword.value) {
      await authRequest<void>("/change-password", {
        oldPassword: form.oldPassword,
        newPassword: form.password
      });
    } else {
      await authRequest<void>("/initial-password", {
        account: form.account,
        code: form.code,
        newPassword: form.password
      });
    }
    form.oldPassword = "";
    form.password = "";
    form.confirmPassword = "";
    form.code = "";
    message(
      hasPassword.value
        ? "密码修改成功，请重新登录"
        : "密码设置成功，请重新登录",
      { type: "success" }
    );
    useUserStoreHook().logOut();
  } catch (error) {
    message(error.message || "密码修改失败，请稍后重试", { type: "error" });
  } finally {
    loading.value = false;
  }
}
onMounted(loadPasswordStatus);
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">账户管理</h3>
    <div v-for="item in list" :key="item.title">
      <div class="flex items-center">
        <div class="flex-1">
          <p>{{ item.title }}</p>
          <el-text class="mx-1" type="info">{{ item.illustrate }}</el-text>
        </div>
        <el-button
          type="primary"
          text
          :loading="item.password && fetching"
          @click="onClick(item)"
          >{{
            item.password && hasPassword === false ? "设置" : "修改"
          }}</el-button
        >
      </div>
      <el-divider />
    </div>
    <el-dialog
      v-model="passwordDialogVisible"
      :title="passwordTitle"
      :width="deviceDetection() ? '90%' : '520px'"
      :close-on-click-modal="false"
      :close-on-press-escape="!loading && !sending"
      :show-close="!loading && !sending"
      @closed="resetPasswordForm"
    >
      <el-text type="info">{{
        hasPassword
          ? "请输入旧密码和新密码，修改后需要重新登录。"
          : boundAccount
            ? "验证当前账号后首次设置本系统密码，原第三方登录方式保留。"
            : "先验证并绑定手机号或邮箱，再设置本系统密码；原飞书登录方式保留。"
      }}</el-text>
      <el-form
        ref="formRef"
        class="mt-6 max-w-120"
        :model="form"
        :rules="rules"
        :disabled="loading"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item v-if="hasPassword" label="旧密码" prop="oldPassword">
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="请输入旧密码"
          />
        </el-form-item>
        <template v-else>
          <el-form-item
            :label="boundAccount ? '当前账号' : '绑定手机号或邮箱'"
            prop="account"
          >
            <el-input
              v-model="form.account"
              :disabled="!!boundAccount || sending"
              placeholder="请输入手机号或邮箱"
            />
          </el-form-item>
          <el-form-item label="验证码" prop="code">
            <div class="flex w-full gap-2">
              <el-input
                v-model="form.code"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
                placeholder="请输入6位验证码"
              />
              <el-button
                :loading="sending"
                :disabled="sending || remaining > 0"
                @click="sendCode"
                >{{
                  remaining > 0 ? remaining + "秒后重试" : "获取验证码"
                }}</el-button
              >
            </div>
          </el-form-item>
        </template>
        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少8个字符，不超过72字节"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="请再次输入新密码"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            native-type="submit"
            :loading="loading"
            :disabled="sending"
            >{{ passwordTitle }}</el-button
          >
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.el-divider--horizontal {
  border-top: 0.1px var(--el-border-color) var(--el-border-style);
}
</style>
