<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Id, type ProductCommand } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { signatures, type Axis } from "./specifications";
const emit = defineEmits<{
  changed: [];
  generated: [
    axes: ProductCommand["salesAttributes"],
    skus: ProductCommand["skus"]
  ];
}>();
interface Attribute {
  attributeId: Id;
  name: string;
  inputType: number;
  status: number;
}
interface Value {
  attributeValueId: Id;
  valueName: string;
  status: number;
}
const attributes = ref<Attribute[]>([]);
const values = reactive<Record<string, Value[]>>({});
const axes = ref<Axis[]>([]);
watch(axes, () => emit("changed"), { deep: true });
const error = ref("");
const masterVisible = ref(false);
const masterSaving = ref(false);
const masterRef = ref<FormInstance>();
const master = reactive({
  attributeId: undefined as Id | undefined,
  code: "",
  name: ""
});
async function load() {
  error.value = "";
  try {
    const result: Attribute[] = [];
    let pageNum = 1;
    while (true) {
      const page = await pmsRequest<PageResult<Attribute>>(
        "get",
        "/attributes",
        undefined,
        { pageNum, pageSize: 100, status: 1 }
      );
      result.push(...page.records);
      if (!page.records.length || result.length >= page.total) break;
      pageNum++;
    }
    attributes.value = result.filter(a => a.inputType !== 3);
  } catch (e) {
    error.value = e.message;
  }
}
async function loadValues(axis: Axis) {
  axis.valueIds = [];
  try {
    const id = String(axis.attributeId);
    values[id] = (
      await pmsRequest<Value[]>("get", `/attributes/${id}/values`)
    ).filter(v => v.status === 1);
  } catch (e) {
    ElMessage.error(e.message);
  }
}
function generate() {
  try {
    const result = signatures(axes.value);
    const selections = axes.value.map((axis, index) => ({
      ...axis,
      sortOrder: index
    }));
    const skus: ProductCommand["skus"] = result.map((signature, index) => ({
      specSignature: signature,
      specText: signature
        .split(";")
        .filter(Boolean)
        .map(pair => {
          const [id, value] = pair.split("=");
          return `${attributes.value.find(a => String(a.attributeId) === id)?.name}: ${values[id]?.find(v => String(v.attributeValueId) === value)?.valueName}`;
        })
        .join(" / "),
      retailPrice: 0,
      currencyCode: "CNY",
      status: "1",
      isDefault: index === 0,
      images: []
    }));
    emit("generated", selections, skus);
  } catch (e) {
    ElMessage.error(e.message);
  }
}
function createMaster(attributeId?: Id) {
  Object.assign(master, { attributeId, code: "", name: "" });
  masterVisible.value = true;
}
async function saveMaster() {
  if (!(await masterRef.value?.validate().catch(() => false))) return;
  masterSaving.value = true;
  try {
    if (master.attributeId) {
      await pmsRequest("post", "/attributes/values", {
        attributeId: master.attributeId,
        valueCode: master.code.trim(),
        valueName: master.name.trim(),
        status: "1",
        sortOrder: 0
      });
      values[String(master.attributeId)] = (
        await pmsRequest<Value[]>(
          "get",
          `/attributes/${master.attributeId}/values`
        )
      ).filter(v => v.status === 1);
    } else {
      await pmsRequest("post", "/attributes", {
        attributeCode: master.code.trim(),
        name: master.name.trim(),
        inputType: 2,
        status: "1"
      });
      await load();
    }
    masterVisible.value = false;
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    masterSaving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="specifications">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p>
      选择销售属性及预设值，生成 SKU
      后逐项填写编码和零售价。重新生成会重置下表输入。
    </p>
    <div v-for="(axis, index) in axes" :key="index" class="axis">
      <el-select
        v-model="axis.attributeId"
        filterable
        placeholder="销售属性"
        @change="loadValues(axis)"
        ><el-option
          v-for="attribute in attributes"
          :key="attribute.attributeId"
          :label="attribute.name"
          :value="attribute.attributeId"
      /></el-select>
      <el-select
        v-model="axis.valueIds"
        multiple
        filterable
        placeholder="选择属性值"
        ><el-option
          v-for="value in values[String(axis.attributeId)] || []"
          :key="value.attributeValueId"
          :label="value.valueName"
          :value="value.attributeValueId"
      /></el-select>
      <el-button
        :disabled="!axis.attributeId"
        @click="createMaster(axis.attributeId)"
        >添加属性值</el-button
      ><el-button @click="axes.splice(index, 1)">移除</el-button>
    </div>
    <el-button @click="axes.push({ attributeId: '', valueIds: [] })"
      >添加销售属性</el-button
    ><el-button @click="createMaster()">新增属性</el-button
    ><el-button type="primary" @click="generate">生成 SKU</el-button>
    <el-dialog
      v-model="masterVisible"
      :title="master.attributeId ? '新增属性值' : '新增销售属性'"
      width="min(500px,90vw)"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!masterSaving"
      :show-close="!masterSaving"
    >
      <el-form
        ref="masterRef"
        :model="master"
        label-width="80px"
        :disabled="masterSaving"
        ><el-form-item
          label="编码"
          prop="code"
          :rules="[{ required: true, whitespace: true, message: '请输入编码' }]"
          ><el-input v-model="master.code" maxlength="64" /></el-form-item
        ><el-form-item
          label="名称"
          prop="name"
          :rules="[{ required: true, whitespace: true, message: '请输入名称' }]"
          ><el-input v-model="master.name" maxlength="64" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button :disabled="masterSaving" @click="masterVisible = false"
          >取消</el-button
        ><el-button type="primary" :loading="masterSaving" @click="saveMaster"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<style scoped>
.specifications {
  margin-bottom: 20px;
}

.specifications p {
  color: var(--el-text-color-secondary);
}

.axis {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.axis .el-select {
  flex: 1;
  min-width: 0;
}
</style>
