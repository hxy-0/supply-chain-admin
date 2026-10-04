<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { loadAmap } from "./amapLoader";

interface MapPoint {
  longitude: number;
  latitude: number;
  plateNumber?: string;
  vehicleId?: string;
  speedKph?: number;
  gpsTime?: number;
}

const props = defineProps<{
  points: MapPoint[];
  track?: boolean;
  selectable?: boolean;
  activeIndex?: number;
  height?: string;
}>();
const emit = defineEmits<{ select: [location: Record<string, unknown>] }>();
const container = ref<HTMLElement>(),
  error = ref("");
let map: any,
  AMap: any,
  overlays: any[] = [],
  marker: any,
  disposed = false,
  selection = 0;

function render() {
  if (!map) return;
  map.remove(overlays);
  overlays = [];
  marker = undefined;
  const points = props.points.filter(
    p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude)
  );
  if (props.track) {
    if (points.length > 1)
      overlays.push(
        new AMap.Polyline({
          path: points.map(p => [p.longitude, p.latitude]),
          strokeColor: "#409eff",
          strokeWeight: 5
        })
      );
    if (points.length) {
      marker = new AMap.Marker({
        position: [points[0].longitude, points[0].latitude],
        title: points[0].plateNumber || "轨迹车辆"
      });
      overlays.push(marker);
      overlays.push(
        new AMap.Marker({
          position: [
            points[points.length - 1].longitude,
            points[points.length - 1].latitude
          ],
          title: "终点"
        })
      );
    }
  } else {
    for (const p of points) {
      const item = new AMap.Marker({
        position: [p.longitude, p.latitude],
        title: p.plateNumber || p.vehicleId || "位置"
      });
      item.on("click", () => {
        const info = new AMap.InfoWindow({
          content: document.createElement("div")
        });
        const content = document.createElement("div");
        content.textContent = `${p.plateNumber || p.vehicleId || "位置"} · ${p.speedKph ?? 0} km/h`;
        info.setContent(content);
        info.open(map, [p.longitude, p.latitude]);
      });
      overlays.push(item);
    }
  }
  map.add(overlays);
  if (overlays.length) map.setFitView(overlays);
  move();
}

function move() {
  const p = props.points[props.activeIndex ?? 0];
  if (marker && p) marker.setPosition([p.longitude, p.latitude]);
}

watch(() => [props.points, props.track], render, { deep: true });
watch(() => props.activeIndex, move);
onMounted(async () => {
  try {
    AMap = await loadAmap();
    if (disposed) return;
    map = new AMap.Map(container.value, { zoom: 5, center: [105, 35] });
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar());
    if (props.selectable)
      map.on("click", (event: any) => {
        const version = ++selection;
        const longitude = event.lnglat.getLng(),
          latitude = event.lnglat.getLat();
        emit("select", { longitude, latitude });
        new AMap.Geocoder().getAddress(
          [longitude, latitude],
          (status: string, result: any) => {
            if (disposed || version !== selection || status !== "complete")
              return;
            const address = result.regeocode.addressComponent;
            emit("select", {
              longitude,
              latitude,
              formattedAddress: result.regeocode.formattedAddress,
              province: address.province,
              city: address.city || address.province,
              district: address.district,
              adCode: address.adcode,
              country: "中国"
            });
          }
        );
      });
    render();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
});
onUnmounted(() => {
  disposed = true;
  selection++;
  map?.destroy();
});
</script>
<template>
  <div>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <div
      v-show="!error"
      ref="container"
      :style="{ height: height || '420px', width: '100%', borderRadius: '6px' }"
    />
    <p v-if="selectable && !error">点击地图可选取坐标并回填地址</p>
  </div>
</template>
