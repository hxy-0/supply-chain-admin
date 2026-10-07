<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { pmsRequest, type Sku } from "@/api/pms";

interface Price {
  countryCode: string;
  currencyCode: string;
  retailPrice: number;
  taxIncluded: boolean;
  isEnable: boolean;
}
interface Snapshot {
  skuId: string;
  version: number;
  prices: Price[];
}
interface Option {
  code: string;
  name: string;
}
const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ targets: Sku[] }>();
const emit = defineEmits<{ saved: [] }>();
const prices = ref<Price[]>([]);
const snapshots = ref<Snapshot[]>([]);
const options = ref<{ countries: Option[]; currencies: Option[] }>({
  countries: [],
  currencies: []
});
const loading = ref(false);
const saving = ref(false);
const failure = ref("");
function add() {
  prices.value.push({
    countryCode: "CN",
    currencyCode: "CNY",
    retailPrice: 0,
    taxIncluded: true,
    isEnable: true
  });
}
watch(visible, async value => {
  if (!value) return;
  loading.value = true;
  failure.value = "";
  prices.value = [];
  snapshots.value = [];
  try {
    if (!options.value.countries.length)
      options.value = await pmsRequest("get", "/skus/price-options");
    if (props.targets.length === 1) {
      snapshots.value = [
        await pmsRequest<Snapshot>(
          "get",
          `/skus/${props.targets[0].skuId}/prices`
        )
      ];
    } else {
      // 批量只提交列表中的版本，其他地区价格由后端合并，避免逐个加载 SKU。
      snapshots.value = props.targets.map(sku => {
        if (sku.skuId == null || sku.version == null)
          throw new Error("请刷新 SKU 列表后重试");
        return { skuId: String(sku.skuId), version: sku.version, prices: [] };
      });
    }
    if (snapshots.value.length === 1)
      prices.value = snapshots.value[0].prices.map(price => ({ ...price }));
    else add();
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "价格加载失败";
  } finally {
    loading.value = false;
  }
});
async function save() {
  if (loading.value || saving.value || failure.value) return;
  const keys = new Set<string>();
  for (const price of prices.value) {
    if (
      !price.countryCode ||
      !price.currencyCode ||
      price.retailPrice == null ||
      !Number.isFinite(price.retailPrice) ||
      price.retailPrice < 0
    ) {
      ElMessage.warning("请填写地区、币种和非负价格");
      return;
    }
    const key = `${price.countryCode}:${price.currencyCode}`;
    if (keys.has(key)) {
      ElMessage.warning("同一地区、币种的价格不能重复");
      return;
    }
    keys.add(key);
  }
  if (snapshots.value.length > 1 && !prices.value.length) {
    ElMessage.warning("请至少添加一条价格");
    return;
  }
  saving.value = true;
  try {
    if (snapshots.value.length === 1) {
      const sku = snapshots.value[0];
      await pmsRequest("post", `/skus/${sku.skuId}/prices`, {
        version: sku.version,
        prices: prices.value
      });
    } else {
      await pmsRequest("post", "/skus/prices/batch", {
        targets: snapshots.value.map(sku => ({
          skuId: sku.skuId,
          version: sku.version
        })),
        prices: prices.value
      });
    }
    ElMessage.success("地区价格已保存");
    visible.value = false;
    emit("saved");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "价格保存失败");
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="
      targets.length > 1
        ? `批量维护价格（${targets.length} 个 SKU）`
        : 'SKU 价格维护'
    "
    width="min(1080px,96vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving && !loading"
    :show-close="!saving && !loading"
  >
    <div v-loading="loading">
      <p v-if="targets.length === 1">{{ targets[0].skuCode }}</p>
      <el-alert
        v-if="targets.length > 1"
        title="新增或覆盖相同地区、币种的价格，保留其他地区价格。"
        type="info"
        :closable="false"
      />
      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />
      <el-table :data="prices">
        <el-table-column label="销售国家/地区" min-width="190"
          ><template #default="{ row }">
            <el-select
              v-model="row.countryCode"
              filterable
              :disabled="saving || loading"
            >
              <el-option
                v-for="option in options.countries"
                :key="option.code"
                :value="option.code"
                :label="`${option.name} (${option.code})`"
              />
            </el-select> </template
        ></el-table-column>
        <el-table-column label="币种" min-width="190"
          ><template #default="{ row }">
            <el-select
              v-model="row.currencyCode"
              filterable
              :disabled="saving || loading"
            >
              <el-option
                v-for="option in options.currencies"
                :key="option.code"
                :value="option.code"
                :label="`${option.code} / ${option.name}`"
              />
            </el-select> </template
        ></el-table-column>
        <el-table-column label="零售价" width="190"
          ><template #default="{ row }">
            <el-input-number
              v-model="row.retailPrice"
              :min="0"
              :precision="4"
              :max="999999999999999"
              :disabled="saving || loading"
            /> </template
        ></el-table-column>
        <el-table-column label="含税" width="90"
          ><template #default="{ row }"
            ><el-switch
              v-model="row.taxIncluded"
              :disabled="saving || loading" /></template
        ></el-table-column>
        <el-table-column label="启用" width="90"
          ><template #default="{ row }"
            ><el-switch
              v-model="row.isEnable"
              :disabled="saving || loading" /></template
        ></el-table-column>
        <el-table-column label="操作" width="80"
          ><template #default="{ $index }"
            ><el-button
              type="danger"
              link
              :disabled="saving || loading"
              @click="prices.splice($index, 1)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button
        :disabled="saving || loading || !!failure || prices.length >= 200"
        @click="add"
        >添加地区价格</el-button
      >
      <p class="price-help">
        未配置的地区、币种视为未定价。含税开关用于注明报价口径。
      </p>
    </div>
    <template #footer
      ><el-button :disabled="saving || loading" @click="visible = false"
        >取消</el-button
      ><el-button
        type="primary"
        :loading="saving"
        :disabled="loading || !!failure || !snapshots.length"
        @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
<style scoped>
.price-help {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}

.el-table {
  margin: 12px 0;
}
</style>
