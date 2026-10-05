<script setup lang="ts">
import { computed, ref } from "vue";
import type { FormInstance } from "element-plus";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

const props = defineProps<{ model: { newPwd: string } }>();
const formRef = ref<FormInstance>();
const passwordModel = props.model;
const factory = new ZxcvbnFactory();
const score = computed(() =>
  passwordModel.newPwd ? factory.check(passwordModel.newPwd).score : -1
);
const progress = [
  { color: "#e74242", text: "非常弱" },
  { color: "#EFBD47", text: "弱" },
  { color: "#ffa500", text: "一般" },
  { color: "#1bbf1b", text: "强" },
  { color: "#008000", text: "非常强" }
];
defineExpose({ getRef: () => formRef.value });
</script>

<template>
  <el-form ref="formRef" :model="passwordModel">
    <el-form-item
      prop="newPwd"
      :rules="[{ required: true, message: '请输入新密码', trigger: 'blur' }]"
    >
      <el-input
        v-model="passwordModel.newPwd"
        clearable
        show-password
        type="password"
        placeholder="请输入新密码"
      />
    </el-form-item>
  </el-form>
  <div class="my-4 flex">
    <div
      v-for="({ color, text }, index) in progress"
      :key="text"
      class="w-[19vw]"
      :style="{ marginLeft: index !== 0 ? '4px' : 0 }"
    >
      <el-progress
        striped
        striped-flow
        :duration="score === index ? 6 : 0"
        :percentage="score >= index ? 100 : 0"
        :color="color"
        :stroke-width="10"
        :show-text="false"
      />
      <p class="text-center" :style="{ color: score === index ? color : '' }">
        {{ text }}
      </p>
    </div>
  </div>
</template>
