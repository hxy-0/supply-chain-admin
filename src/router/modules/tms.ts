const Layout = () => import("@/layout/index.vue");

export default {
  path: "/tms",
  name: "Tms",
  component: Layout,
  redirect: "/tms/queue/config",
  meta: { icon: "ri:truck-line", title: "运输管理", rank: 2 },
  children: [
    {
      path: "/tms/queue",
      name: "TmsQueueGroup",
      redirect: "/tms/queue/config",
      meta: { icon: "ri:numbers-line", title: "排队叫号" },
      children: [
        { path: "/tms/queue/config", name: "TmsQueueConfig", component: () => import("@/views/tms/queue/index.vue"), meta: { title: "排队场景" } },
        { path: "/tms/queue/call-board", name: "TmsCallBoard", component: () => import("@/views/tms/queue/index.vue"), meta: { title: "叫号台" } },
        { path: "/tms/queue/ticket-record", name: "TmsTicketRecord", component: () => import("@/views/tms/queue/index.vue"), meta: { title: "排队记录" } },
        { path: "/tms/queue/take-number", name: "TmsTakeNumber", component: () => import("@/views/tms/queue/index.vue"), meta: { title: "模拟取号" } }
      ]
    },
    {
      path: "/tms/fleet",
      name: "TmsFleetGroup",
      redirect: "/tms/fleet/driver",
      meta: { icon: "ri:roadster-line", title: "车队资料" },
      children: [
        { path: "/tms/fleet/driver", name: "TmsDriver", component: () => import("@/views/tms/fleet/index.vue"), meta: { title: "司机管理" } },
        { path: "/tms/fleet/carrier", name: "TmsCarrier", component: () => import("@/views/tms/fleet/index.vue"), meta: { title: "承运商管理" } },
        { path: "/tms/fleet/vehicle", name: "TmsVehicle", component: () => import("@/views/tms/fleet/index.vue"), meta: { title: "车辆管理" } },
        { path: "/tms/fleet/logistic-node", name: "TmsLogisticNode", component: () => import("@/views/tms/fleet/index.vue"), meta: { title: "物流节点" } }
      ]
    },
    {
      path: "/tms/monitoring",
      name: "TmsMonitoringGroup",
      redirect: "/tms/monitoring/realtime",
      meta: { icon: "ri:map-pin-line", title: "车辆监控" },
      children: [
        { path: "/tms/monitoring/realtime", name: "TmsRealtimeVehicle", component: () => import("@/views/tms/monitoring/index.vue"), meta: { title: "实时车辆" } },
        { path: "/tms/monitoring/track", name: "TmsVehicleTrack", component: () => import("@/views/tms/monitoring/index.vue"), meta: { title: "车辆轨迹" } }
      ]
    }
  ]
} satisfies RouteConfigsTable;
