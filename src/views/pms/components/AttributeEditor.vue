<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Attribute } from "@/api/pms";
import { errorMessage } from "../composables/usePmsPage";
const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ attribute?: Attribute }>();
const emit = defineEmits<{ saved: [attribute: Attribute] }>();
const formRef = ref<FormInstance>();
const saving = ref(false);
const form = reactive({
  attributeId: undefined as Attribute["attributeId"] | undefined,
  attributeCode: "",
  name: "",
  inputType: 2,
  unit: "",
  isEnable: 1
});
watch(visible, value => {
  if (value)
    Object.assign(
      form,
      {
        attributeId: undefined,
        attributeCode: "",
        name: "",
        inputType: 2,
        unit: "",
        isEnable: 1
      },
      props.attribute
        ? { ...props.attribute, isEnable: props.attribute.isEnable }
        : {}
    );
});
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const result = await pmsRequest<Attribute>("post", "/attributes", {
      ...form,
      attributeCode: form.attributeCode.trim(),
      name: form.name.trim()
    });
    ElMessage.success("属性已保存");
    visible.value = false;
    emit("saved", result);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="attribute ? '编辑属性' : '新增属性'"
    width="min(560px,94vw)"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    :show-close="!saving"
    :close-on-press-escape="!saving"
  >
    <el-form ref="formRef" :model="form" label-width="90px" :disabled="saving">
      <el-form-item
        label="属性编码"
        prop="attributeCode"
        :rules="[
          { required: true, whitespace: true, message: '请输入属性编码' }
        ]"
        ><el-input v-model="form.attributeCode" maxlength="64"
      /></el-form-item>
      <el-form-item
        label="属性名称"
        prop="name"
        :rules="[
          { required: true, whitespace: true, message: '请输入属性名称' }
        ]"
        ><el-input v-model="form.name" maxlength="64"
      /></el-form-item>
      <el-form-item label="输入方式"
        ><el-select v-model="form.inputType"
          ><el-option label="单选" :value="1" /><el-option
            label="多选"
            :value="2" /><el-option label="自由输入" :value="3" /></el-select
      ></el-form-item>
      <el-form-item label="单位"
        ><el-input v-model="form.unit" maxlength="32"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-radio-group v-model="form.isEnable"
          ><el-radio :value="1">启用</el-radio
          ><el-radio :value="0">停用</el-radio></el-radio-group
        ></el-form-item
      >
      <el-alert
        title="属性为全局字典；在分类的销售属性配置中指定它用于销售规格还是普通参数。"
        type="info"
        :closable="false"
      />
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
