<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Motion from "./utils/motion";
import { authRequest, completeLogin } from "./utils/authentication";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import TypeIt from "@/components/ReTypeit";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import type { FormInstance } from "element-plus";
import { operates, thirdParty } from "./utils/enums";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { ref, reactive, watch, computed } from "vue";
import LoginVerification from "./components/LoginVerification.vue";
import FeishuQrLogin from "./components/FeishuQrLogin.vue";
import Github from "@/assets/svg/GitHub.svg?component";
import Wechat from "@/assets/svg/wechat.svg?component";
import Alipay from "@/assets/svg/alipay.svg?component";
import Feishu from "@/assets/svg/Feishu.svg?component";
import AppLogo from "@/components/AppLogo/index.vue";
import type { Component } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";
import Info from "~icons/ri/information-line";

defineOptions({
  name: "Login"
});

const loginVideo = `${import.meta.env.BASE_URL}media/city-logistics-login.mp4`;
const thirdPartyLogos: Record<string, Component> = {
  wechat: Wechat,
  alipay: Alipay,
  feishu: Feishu,
  github: Github
};
const loginDay = ref(7);
const loading = ref(false);
const feishuQrVisible = ref(false);
const checked = ref(false);
const disabled = ref(false);
const ruleFormRef = ref<FormInstance>();
const currentPage = computed(() => {
  return useUserStoreHook().currentPage;
});

const { t } = useI18n();
const { initStorage } = useLayout();
initStorage();
const { dataTheme, themeMode, dataThemeChange } = useDataThemeChange();
dataThemeChange(themeMode.value);
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn } = useTranslationLang();

const ruleForm = reactive({
  username: "",
  password: ""
});

const onLogin = async (formEl: FormInstance | undefined) => {
  if (loading.value || !(await formEl?.validate().catch(() => false))) {
    return;
  }
  loading.value = true;
  try {
    const store = useUserStoreHook();
    await completeLogin(
      await authRequest("/login", {
        username: ruleForm.username,
        password: ruleForm.password,
        rememberDays: checked.value ? store.loginDay : 1
      })
    );
  } catch (error) {
    message(error.message, { type: "error" });
  } finally {
    loading.value = false;
  }
};
const immediateDebounce = debounce(
  () => onLogin(ruleFormRef.value),
  1000,
  true
);
async function thirdLogin(provider: string) {
  if (provider !== "github" && provider !== "feishu") {
    message(t("login.pureProviderPending"), { type: "info" });
    return;
  }
  if (loading.value) {
    return;
  }
  if (provider === "feishu") {
    feishuQrVisible.value = true;
    return;
  }
  loading.value = true;
  try {
    const result = await authRequest<{ authorizationUrl: string }>(
      `/${provider}/authorize`
    );
    window.location.assign(result.authorizationUrl);
  } catch (error) {
    message(error.message, { type: "error" });
    loading.value = false;
  }
}

watch(checked, bool => {
  useUserStoreHook().SET_ISREMEMBERED(bool);
});
watch(loginDay, value => {
  useUserStoreHook().SET_LOGINDAY(value);
});
</script>

<template>
  <div class="select-none login-page">
    <video
      class="login-background-video"
      :src="loginVideo"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      aria-label="供应链场景动画"
    />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
      <!-- 国际化 -->
      <el-dropdown trigger="click">
        <globalization
          class="hover:text-primary hover:bg-transparent! size-5 ml-1.5 cursor-pointer outline-hidden duration-300"
        />
        <template #dropdown>
          <el-dropdown-menu class="translation">
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'zh')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
              @click="translationCh"
            >
              <IconifyIconOffline
                v-show="locale === 'zh'"
                class="check-zh"
                :icon="Check"
              />
              简体中文
            </el-dropdown-item>
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'en')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
              @click="translationEn"
            >
              <span v-show="locale === 'en'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              English
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="login-container">
      <div class="login-box">
        <div class="login-form">
          <AppLogo :size="88" original class="avatar" />
          <Motion>
            <h2 class="outline-hidden">
              <TypeIt
                :options="{ strings: [title], cursor: false, speed: 100 }"
              />
            </h2>
          </Motion>

          <el-form
            v-if="currentPage === 0 && !feishuQrVisible"
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
            @submit.prevent="immediateDebounce"
          >
            <Motion :delay="100">
              <el-form-item prop="username">
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  :placeholder="t('login.pureAccount')"
                  autocomplete="username"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  autocomplete="current-password"
                  :placeholder="t('login.purePassword')"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="250">
              <el-form-item>
                <div class="w-full h-5 flex-bc">
                  <el-checkbox v-model="checked">
                    <span class="flex">
                      <select
                        v-model="loginDay"
                        :style="{
                          width: loginDay < 10 ? '10px' : '16px',
                          outline: 'none',
                          background: 'none',
                          appearance: 'none',
                          border: 'none'
                        }"
                      >
                        <option value="1">1</option>
                        <option value="7">7</option>
                        <option value="30">30</option>
                      </select>
                      {{ t("login.pureRemember") }}
                      <IconifyIconOffline
                        v-tippy="{
                          content: t('login.pureRememberInfo'),
                          placement: 'top'
                        }"
                        :icon="Info"
                        class="ml-1"
                      />
                    </span>
                  </el-checkbox>
                  <el-button
                    link
                    type="primary"
                    @click="useUserStoreHook().SET_CURRENTPAGE(4)"
                  >
                    {{ t("login.pureForget") }}
                  </el-button>
                </div>
                <el-button
                  class="w-full mt-4!"
                  size="default"
                  type="primary"
                  :loading="loading"
                  :disabled="disabled"
                  native-type="submit"
                >
                  {{ t("login.pureLogin") }}
                </el-button>
              </el-form-item>
            </Motion>

            <Motion :delay="300">
              <el-form-item>
                <div class="auth-alternatives">
                  <el-button
                    v-for="(item, index) in operates"
                    :key="index"
                    class="auth-alternative"
                    size="default"
                    @click="useUserStoreHook().SET_CURRENTPAGE(item.page)"
                  >
                    {{ t(item.title) }}
                  </el-button>
                </div>
              </el-form-item>
            </Motion>
          </el-form>

          <FeishuQrLogin
            v-if="currentPage === 0 && feishuQrVisible"
            @back="feishuQrVisible = false"
          />
          <Motion v-if="currentPage === 0 && !feishuQrVisible" :delay="350">
            <el-form-item>
              <el-divider class="auth-divider">
                <p class="text-gray-500 text-xs">
                  {{ t("login.pureThirdLogin") }}
                </p>
              </el-divider>
              <div class="third-party-login">
                <button
                  v-for="(item, index) in thirdParty"
                  :key="index"
                  :title="t(item.title)"
                  :aria-label="t(item.title)"
                  type="button"
                  class="third-party-button"
                  :disabled="loading"
                  @click="thirdLogin(item.icon)"
                >
                  <component
                    :is="thirdPartyLogos[item.icon]"
                    class="third-party-icon"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </el-form-item>
          </Motion>
          <LoginVerification v-if="currentPage === 1" mode="login" />
          <LoginVerification v-if="currentPage === 3" mode="register" />
          <LoginVerification v-if="currentPage === 4" mode="reset" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.translation {
  :deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
