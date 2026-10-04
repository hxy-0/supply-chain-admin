export default {
  path: "/pms",
  name: "Pms",
  component: () => import("@/layout/index.vue"),
  redirect: "/pms/products",
  meta: {
    icon: "ri:shopping-bag-3-line",
    title: "商品管理",
    rank: 3
  },
  children: [
    {
      path: "/pms/products",
      name: "PmsProducts",
      component: () => import("@/views/pms/products/index.vue"),
      meta: { title: "商品列表", roles: ["admin"] }
    }
  ]
} satisfies RouteConfigsTable;
