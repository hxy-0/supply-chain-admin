<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import QRCode from "qrcode";
import { driverApi } from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
const form = defineModel<Record<string, any>>({ required: true });
const open = ref(false),
  busy = ref(false),
  qr = ref("");
let timer: ReturnType<typeof setInterval>,
  generation = 0;
function stop() {
  generation++;
  clearInterval(timer);
}
async function fill() {
  stop();
  busy.value = true;
  const version = generation;
  try {
    const task = await driverApi.profileFillToken();
    const image = await QRCode.toDataURL(task.fillUrl);
    if (version !== generation) return;
    qr.value = image;
    open.value = true;
    let tries = 0,
      polling = false;
    timer = setInterval(async () => {
      if (polling) return;
      if (++tries > 300) {
        stop();
        open.value = false;
        message("二维码已过期，请重新生成", { type: "warning" });
        return;
      }
      polling = true;
      try {
        const result = await driverApi.profileFill(task.fillToken);
        if (version !== generation) return;
        if (result.status === "filled" && result.profile) {
          const p = result.profile;
          Object.assign(form.value, {
            wechatOpenid: p.openid,
            wechatNickname: p.nickname,
            wechatAvatarUrl: p.headimgurl,
            wechatSex: p.sex || undefined,
            wechatProvince: p.province,
            wechatCity: p.city,
            wechatUnionid: p.unionid
          });
          stop();
          open.value = false;
          message("微信资料已填充，请填写真实姓名后保存", { type: "success" });
        }
      } catch {
        /* 下次轮询重试 */
      } finally {
        polling = false;
      }
    }, 2000);
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
async function sync() {
  busy.value = true;
  try {
    await driverApi.syncWechatProfile(form.value.id);
    const record = await driverApi.get(form.value.id);
    for (const key of Object.keys(record))
      if (key.startsWith("wechat")) form.value[key] = record[key];
    message("微信资料已同步", { type: "success" });
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
onUnmounted(stop);
</script>
<template>
  <el-divider content-position="left">微信资料</el-divider>
  <div class="flex gap-3 mb-4">
    <el-avatar :src="form.wechatAvatarUrl" :size="48" /><el-button
      :loading="busy"
      @click="fill"
      >扫码填充资料</el-button
    ><el-button
      v-if="form.id && form.wechatOpenid"
      :loading="busy"
      @click="sync"
      >同步微信资料</el-button
    >
  </div>
  <el-row :gutter="16"
    ><el-col :span="12"
      ><el-form-item label="微信昵称"
        ><el-input v-model="form.wechatNickname" /></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="性别"
        ><el-select v-model="form.wechatSex" clearable
          ><el-option label="男" :value="1" /><el-option
            label="女"
            :value="2" /></el-select></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="省份"
        ><el-input v-model="form.wechatProvince" /></el-form-item></el-col
    ><el-col :span="12"
      ><el-form-item label="城市"
        ><el-input v-model="form.wechatCity" /></el-form-item></el-col
  ></el-row>
  <BusinessDialog
    v-model="open"
    title="扫码填充微信资料"
    width="400px"
    readonly
    @closed="stop"
    ><div class="text-center">
      <img :src="qr" alt="微信授权二维码" style="width: 240px; margin: auto" />
      <p>微信扫码授权后自动填充资料，二维码10分钟有效</p>
    </div></BusinessDialog
  >
</template>
