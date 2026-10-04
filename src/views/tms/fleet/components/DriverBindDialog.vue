<script setup lang="ts">
import { ref, watch } from "vue";
import QRCode from "qrcode";
import { driverApi, mockWechatApi } from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
const props = defineProps<{ driver?: Record<string, any> }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ changed: [] }>();
const qr = ref(""),
  busy = ref(false),
  openid = ref(""),
  phone = ref(""),
  reply = ref("");
const isDev = import.meta.env.DEV;
const baseUrl = import.meta.env.BASE_URL;
let requestId = 0;
watch(open, async value => {
  const id = ++requestId;
  qr.value = "";
  reply.value = "";
  if (!value || !props.driver) return;
  phone.value = props.driver.phone;
  openid.value = props.driver.wechatOpenid || "";
  busy.value = true;
  try {
    const info = await driverApi.bindQr(props.driver.id);
    const image = await QRCode.toDataURL(info.bindUrl);
    if (id === requestId) qr.value = image;
  } catch (error) {
    if (id === requestId) message(String(error), { type: "error" });
  } finally {
    if (id === requestId) busy.value = false;
  }
});
async function simulate() {
  if (!openid.value.trim() || !phone.value.trim())
    return message("请填写OpenID和手机号", { type: "warning" });
  busy.value = true;
  try {
    const result = await mockWechatApi.mpMessage({
      openid: openid.value.trim(),
      content: phone.value.trim()
    });
    reply.value =
      result.reply +
      (result.pushError ? `；推送失败：${result.pushError}` : "");
    emit("changed");
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
async function refresh() {
  if (!props.driver) return;
  busy.value = true;
  try {
    const result = await driverApi.subscribeStatus(props.driver.id);
    message(
      result.bound
        ? result.subscribed
          ? "绑定成功且已关注"
          : "已绑定，尚未关注"
        : "尚未绑定",
      { type: "info" }
    );
    emit("changed");
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <BusinessDialog
    v-model="open"
    :title="`微信绑定：${driver?.name || ''}`"
    width="500px"
    readonly
  >
    <div v-loading="busy" class="text-center">
      <img
        v-if="qr"
        :src="qr"
        alt="司机微信绑定二维码"
        style="width: 240px; margin: auto"
      />
      <p>使用司机微信扫码完成绑定，二维码10分钟有效</p>
      <el-button :disabled="busy" @click="refresh"
        >刷新绑定及关注状态</el-button
      >
    </div>
    <el-divider>公众号关注绑定</el-divider>
    <div class="text-center">
      <img
        :src="`${baseUrl}wechat-mp-qrcode.png`"
        alt="公众号关注二维码"
        style="width: 180px; margin: auto"
      />
      <p>
        微信扫码关注公众号，在公众号对话中回复登记手机号：<b>{{
          driver?.phone
        }}</b>
      </p>
      <p>收到绑定成功回复后，可接收公众号消息推送。</p>
    </div>
    <template v-if="isDev"
      ><el-divider>本地模拟公众号回复手机号</el-divider
      ><el-input
        v-model="openid"
        placeholder="微信OpenID"
        class="mb-3"
      /><el-input v-model="phone" placeholder="手机号" class="mb-3" /><el-button
        :loading="busy"
        @click="simulate"
        >模拟回复</el-button
      >
      <p>{{ reply }}</p></template
    >
  </BusinessDialog>
</template>
