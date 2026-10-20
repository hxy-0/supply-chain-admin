<script setup lang="ts">
import BusinessDrawer from "@/components/Tms/BusinessDrawer.vue";
import { formatDateTime } from "@/utils/date";
import {
  statusLabels,
  statusTagTypes,
  tempLabels,
  pickupTypeLabels,
  transportModeLabels,
  transportModeTagTypes,
  handoverStatusLabels,
  formatWeight,
  formatVolume
} from "./presentation";
import type { WaybillDetail } from "@/api/tmsWaybill";

defineProps<{ detail: WaybillDetail }>();
const open = defineModel<boolean>({ required: true });
</script>
<template>
  <BusinessDrawer v-model="open" title="运单详情" size="860px">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="运单号">{{
        detail.waybill.waybillNo
      }}</el-descriptions-item>
      <el-descriptions-item label="订单号">{{
        detail.waybill.orderNo || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="状态"
        ><el-tag :type="statusTagTypes[detail.waybill.status] as any">{{
          statusLabels[detail.waybill.status]
        }}</el-tag></el-descriptions-item
      >
      <el-descriptions-item label="温区">{{
        tempLabels[detail.waybill.tempZone]
      }}</el-descriptions-item>
      <el-descriptions-item label="取件方式">{{
        pickupTypeLabels[detail.waybill.pickupType] || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="件数">{{
        detail.waybill.pieceCount ?? "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="商品" :span="2">{{
        detail.waybill.goodsSummary || detail.waybill.goodsName || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="重量(kg)">{{
        formatWeight(detail.waybill.weightKg)
      }}</el-descriptions-item>
      <el-descriptions-item label="体积(m³)">{{
        formatVolume(detail.waybill.volumeCm3)
      }}</el-descriptions-item>
      <el-descriptions-item label="发货人">{{
        detail.waybill.senderName
          ? `${detail.waybill.senderName} ${detail.waybill.senderPhone ?? ""}`
          : "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="发货地址">{{
        detail.waybill.senderAddress || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="收货人">{{
        detail.waybill.receiverName
          ? `${detail.waybill.receiverName} ${detail.waybill.receiverPhone ?? ""}`
          : "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="收货地址">{{
        detail.waybill.receiverAddress || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="签收时间">{{
        formatDateTime(detail.waybill.signedTime)
      }}</el-descriptions-item>
      <el-descriptions-item label="签收操作人">{{
        detail.waybill.signOperator || "—"
      }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{
        formatDateTime(detail.waybill.createTime)
      }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{
        detail.waybill.remark || "—"
      }}</el-descriptions-item>
      <el-descriptions-item
        v-if="detail.waybill.cancelReason"
        label="作废原因"
        :span="2"
        >{{ detail.waybill.cancelReason }}</el-descriptions-item
      >
    </el-descriptions>

    <template v-if="detail.items.length">
      <h4 class="section-title">实提明细（SKU）</h4>
      <el-table :data="detail.items" size="small" border>
        <el-table-column prop="skuCode" label="SKU编码" min-width="120"
          ><template #default="{ row }">{{
            row.skuCode || "—"
          }}</template></el-table-column
        >
        <el-table-column prop="goodsName" label="商品名称" min-width="160" />
        <el-table-column prop="specText" label="规格" min-width="120"
          ><template #default="{ row }">{{
            row.specText || "—"
          }}</template></el-table-column
        >
        <el-table-column prop="unit" label="单位" width="80"
          ><template #default="{ row }">{{
            row.unit || "—"
          }}</template></el-table-column
        >
        <el-table-column prop="actualQuantity" label="实提数量" width="110" />
        <el-table-column label="实提时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.actualPickupTime)
          }}</template></el-table-column
        >
      </el-table>
    </template>

    <template v-if="detail.trips.length">
      <h4 class="section-title">运输段</h4>
      <el-table :data="detail.trips" size="small" border>
        <el-table-column prop="tripNo" label="车次号" min-width="180" />
        <el-table-column label="方式" width="110"
          ><template #default="{ row }"
            ><el-tag :type="transportModeTagTypes[row.transportMode] as any">{{
              transportModeLabels[row.transportMode] || row.transportMode
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="plateNumber" label="车牌" width="110"
          ><template #default="{ row }">{{
            row.plateNumber || "—"
          }}</template></el-table-column
        >
        <el-table-column prop="driverName" label="司机" width="100"
          ><template #default="{ row }">{{
            row.driverName || "—"
          }}</template></el-table-column
        >
        <el-table-column prop="fromNodeName" label="起点" min-width="140" />
        <el-table-column prop="toNodeName" label="终点" min-width="140" />
        <el-table-column label="发车时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.departTime)
          }}</template></el-table-column
        >
        <el-table-column label="到达时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.arriveTime)
          }}</template></el-table-column
        >
        <el-table-column label="交接状态" width="100"
          ><template #default="{ row }">{{
            handoverStatusLabels[row.handoverStatus] ?? "—"
          }}</template></el-table-column
        >
      </el-table>
    </template>

    <template v-if="detail.tracks.length">
      <h4 class="section-title">轨迹</h4>
      <el-timeline>
        <el-timeline-item
          v-for="track in detail.tracks"
          :key="track.trackId"
          :timestamp="formatDateTime(track.eventTime)"
        >
          {{ track.eventDesc
          }}<span v-if="track.nodeName" class="track-node"
            >（{{ track.nodeName }}）</span
          >
        </el-timeline-item>
      </el-timeline>
    </template>
  </BusinessDrawer>
</template>
<style scoped>
.section-title {
  margin: 18px 0 10px;
  font-weight: 600;
}

.track-node {
  color: var(--el-text-color-secondary);
}
</style>
