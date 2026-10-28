<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { warehouseApi, type WarehouseForm, type Warehouse } from "@/api/wms";
import { logisticNodeApi, type LogisticNode } from "@/api/tms";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ warehouse?: Warehouse }>();
const emit = defineEmits<{ saved: [] }>();
const formRef = ref<FormInstance>();
const busy = shallowRef(false);
const nodeLoading = shallowRef(false);
const nodes = ref<Pick<LogisticNode, "id" | "name">[]>([]);
const nodeFailure = shallowRef("");
const empty = (): WarehouseForm => ({
  code: "",
  name: "",
  warehouseType: 0,
  status: 0,
  removalStrategy: 0,
  logisticNodeId: "",
  contactPerson: "",
  contactPhone: "",
  province: "",
  city: "",
  district: "",
  address: "",
  remark: ""
});
const form = reactive<WarehouseForm>(empty());
const rules: FormRules = {
  code: [
    {
      required: true,
      whitespace: true,
      message: "请输入仓库编码",
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      whitespace: true,
      message: "请输入仓库名称",
      trigger: "blur"
    }
  ],
  logisticNodeId: [
    { required: true, message: "请选择物流节点", trigger: "change" }
  ]
};
let searchSequence = 0;
async function searchNodes(name: string) {
  const sequence = ++searchSequence;
  nodeLoading.value = true;
  nodeFailure.value = "";
  try {
    const page = await logisticNodeApi.page({ name, pageNum: 1, pageSize: 50 });
    if (sequence !== searchSequence) {
      return;
    }
    nodes.value = page.records;
    if (
      props.warehouse?.logisticNodeId &&
      !nodes.value.some(node => node.id === props.warehouse?.logisticNodeId)
    ) {
      nodes.value.unshift({
        id: props.warehouse.logisticNodeId,
        name: props.warehouse.logisticNodeName || props.warehouse.logisticNodeId
      });
    }
  } catch (error) {
    if (sequence === searchSequence) {
      nodeFailure.value =
        error instanceof Error ? error.message : "物流节点加载失败";
    }
  } finally {
    if (sequence === searchSequence) {
      nodeLoading.value = false;
    }
  }
}
watch(open, value => {
  if (value) {
    Object.assign(form, empty(), { id: undefined }, props.warehouse);
    formRef.value?.clearValidate();
    void searchNodes("");
  }
});
async function save() {
  if (busy.value || !(await formRef.value?.validate().catch(() => false))) {
    return;
  }
  busy.value = true;
  try {
    await warehouseApi.save(form);
    ElMessage.success("仓库已保存");
    open.value = false;
    emit("saved");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="open"
    :title="warehouse ? '修改仓库' : '新增仓库'"
    width="640px"
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="96px"
      :disabled="busy"
    >
      <el-form-item label="仓库编码" prop="code"
        ><el-input v-model="form.code" maxlength="64"
      /></el-form-item>
      <el-form-item label="仓库名称" prop="name"
        ><el-input v-model="form.name" maxlength="128"
      /></el-form-item>
      <el-form-item label="仓库类型"
        ><el-select v-model="form.warehouseType"
          ><el-option
            v-for="(label, value) in ['自营仓', '云仓', '中转仓']"
            :key="value"
            :label="label"
            :value="value" /></el-select
      ></el-form-item>
      <el-form-item label="仓库状态"
        ><el-radio-group v-model="form.status"
          ><el-radio :value="0">启用</el-radio
          ><el-radio :value="1">停用</el-radio></el-radio-group
        ></el-form-item
      >
      <el-form-item label="下架策略"
        ><el-select v-model="form.removalStrategy"
          ><el-option
            v-for="(label, value) in [
              '按库位顺序',
              '库存行创建时间升序',
              '库存行创建时间降序',
              '部分数量优先'
            ]"
            :key="value"
            :label="label"
            :value="value" /></el-select
      ></el-form-item>
      <el-form-item label="物流节点" prop="logisticNodeId"
        ><el-select
          v-model="form.logisticNodeId"
          filterable
          remote
          :remote-method="searchNodes"
          :loading="nodeLoading"
          placeholder="搜索物流节点"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :label="node.name"
            :value="node.id" /></el-select
      ></el-form-item>
      <el-alert
        v-if="nodeFailure"
        :title="nodeFailure"
        type="error"
        :closable="false"
      />
      <el-form-item label="联系人"
        ><el-input v-model="form.contactPerson" maxlength="64"
      /></el-form-item>
      <el-form-item label="联系电话"
        ><el-input v-model="form.contactPhone" maxlength="32"
      /></el-form-item>
      <el-form-item label="省 / 市 / 区"
        ><el-input
          v-model="form.province"
          maxlength="64"
          placeholder="省" /><el-input
          v-model="form.city"
          maxlength="64"
          placeholder="市" /><el-input
          v-model="form.district"
          maxlength="64"
          placeholder="区"
      /></el-form-item>
      <el-form-item label="详细地址"
        ><el-input v-model="form.address" maxlength="512"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" type="textarea" maxlength="512"
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button :disabled="busy" @click="open = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
