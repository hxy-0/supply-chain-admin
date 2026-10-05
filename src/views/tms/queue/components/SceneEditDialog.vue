<script setup lang="ts">
import { ref, watch } from "vue";
import type { FormInstance } from "element-plus";
import {
  queueConfigApi,
  type QueueConfig,
  type QueueTicketType
} from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
const props = defineProps<{ editing?: QueueConfig }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [] }>();
const formRef = ref<FormInstance>();
const busy = ref(false);
const form = ref<Partial<QueueConfig>>({});
const newType = (sortNo: number): QueueTicketType => ({
  ticketTypeName: "",
  prefix: "",
  sequenceLength: 3,
  dailyReset: true,
  sortNo,
  isEnable: 1
});
watch(open, async value => {
  if (!value) return;
  form.value = {
    isEnable: 1,
    callTimeoutSeconds: 300,
    deferredPosition: 3,
    maxCallCount: 2,
    ticketTypes: [newType(0)]
  };
  if (props.editing) {
    busy.value = true;
    try {
      form.value = structuredClone(
        await queueConfigApi.findById(props.editing.queueId)
      );
    } catch (error) {
      message(String(error), { type: "error" });
      open.value = false;
    } finally {
      busy.value = false;
    }
  }
});
async function save() {
  if (busy.value || !(await formRef.value?.validate().catch(() => false)))
    return;
  const types = form.value.ticketTypes || [];
  if (
    !types.length ||
    types.some(
      t => !t.ticketTypeName.trim() || !/^[a-zA-Z]{1,8}$/.test(t.prefix)
    )
  )
    return message("至少配置一个号型，名称不能为空，前缀须为1-8位字母", {
      type: "warning"
    });
  if (new Set(types.map(t => t.prefix.toUpperCase())).size !== types.length)
    return message("号码前缀不能重复", { type: "warning" });
  busy.value = true;
  try {
    await queueConfigApi.saveOrUpdate({
      ...form.value,
      queueCode: form.value.queueCode.trim(),
      queueName: form.value.queueName.trim(),
      ticketTypes: types.map(t => ({
        ...t,
        prefix: t.prefix.toUpperCase(),
        ticketTypeName: t.ticketTypeName.trim()
      }))
    });
    message("保存成功", { type: "success" });
    open.value = false;
    emit("saved");
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
    :title="editing ? '编辑排队场景' : '新建排队场景'"
    width="960px"
    :busy="busy"
    @submit="save"
  >
    <el-form ref="formRef" :model="form" label-position="top" :disabled="busy">
      <el-row :gutter="16">
        <el-col :span="8"
          ><el-form-item
            label="场景编码"
            prop="queueCode"
            :rules="[
              { required: true, whitespace: true, message: '请输入场景编码' }
            ]"
            ><el-input
              v-model="form.queueCode"
              :disabled="!!editing"
              maxlength="64" /></el-form-item
        ></el-col>
        <el-col :span="8"
          ><el-form-item
            label="场景名称"
            prop="queueName"
            :rules="[
              { required: true, whitespace: true, message: '请输入场景名称' }
            ]"
            ><el-input v-model="form.queueName" maxlength="64" /></el-form-item
        ></el-col>
        <el-col :span="8"
          ><el-form-item label="业务分类"
            ><el-input v-model="form.sceneCode" maxlength="32" /></el-form-item
        ></el-col>
        <el-col
          v-for="field in [
            ['callTimeoutSeconds', '叫号超时（秒）', 1],
            ['deferredPosition', '过号后移位数', 0],
            ['maxCallCount', '最大叫号次数', 1]
          ]"
          :key="String(field[0])"
          :span="8"
          ><el-form-item :label="String(field[1])"
            ><el-input-number
              v-model="form[field[0]]"
              :min="Number(field[2])"
              :precision="0" /></el-form-item
        ></el-col>
        <el-col :span="8"
          ><el-form-item label="场景状态"
            ><el-select v-model="form.isEnable"
              ><el-option label="启用" :value="1" /><el-option
                label="停用"
                :value="0" /></el-select></el-form-item
        ></el-col>
        <el-col :span="16"
          ><el-form-item label="备注"
            ><el-input v-model="form.remark" maxlength="200" /></el-form-item
        ></el-col>
      </el-row>
      <el-divider content-position="left">号型配置（至少一个）</el-divider>
      <el-table :data="form.ticketTypes">
        <el-table-column label="名称" min-width="140"
          ><template #default="s"
            ><el-input v-model="s.row.ticketTypeName" /></template
        ></el-table-column>
        <el-table-column label="字母前缀" width="110"
          ><template #default="s"
            ><el-input v-model="s.row.prefix" maxlength="8" /></template
        ></el-table-column>
        <el-table-column label="位数" width="130"
          ><template #default="s"
            ><el-input-number
              v-model="s.row.sequenceLength"
              :min="1"
              :max="8"
              controls-position="right"
              style="width: 110px" /></template
        ></el-table-column>
        <el-table-column label="每天重置" width="100"
          ><template #default="s"
            ><el-switch v-model="s.row.dailyReset" /></template
        ></el-table-column>
        <el-table-column label="排序" width="130"
          ><template #default="s"
            ><el-input-number
              v-model="s.row.sortNo"
              :min="0"
              controls-position="right"
              style="width: 110px" /></template
        ></el-table-column>
        <el-table-column label="启用" width="80"
          ><template #default="s"
            ><el-switch
              v-model="s.row.isEnable"
              :active-value="1"
              :inactive-value="0" /></template
        ></el-table-column>
        <el-table-column label="操作" width="70"
          ><template #default="s"
            ><el-button
              link
              type="danger"
              :disabled="form.ticketTypes.length <= 1"
              @click="form.ticketTypes.splice(s.$index, 1)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button
        class="mt-4"
        @click="form.ticketTypes.push(newType(form.ticketTypes.length))"
        >添加号型</el-button
      >
    </el-form>
  </BusinessDialog>
</template>
