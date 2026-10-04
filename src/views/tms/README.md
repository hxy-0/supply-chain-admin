# TMS 前端迁移

业务页面统一位于 `src/views/tms`，沿用 supply-chain-admin 的 Element Plus、HTTP 鉴权与后台动态菜单机制。

| React 页面          | 管理端路由               | 动态菜单 component   |
| ------------------- | ------------------------ | -------------------- |
| QueueConfigPage     | /tms/queue/config        | tms/queue/index      |
| CallBoardPage       | /tms/queue/call-board    | tms/queue/index      |
| TicketRecordPage    | /tms/queue/ticket-record | tms/queue/index      |
| TakeNumberPage      | /tms/queue/take-number   | tms/queue/index      |
| DriverPage          | /tms/fleet/driver        | tms/fleet/index      |
| CarrierPage         | /tms/fleet/carrier       | tms/fleet/index      |
| VehiclePage         | /tms/fleet/vehicle       | tms/fleet/index      |
| LogisticNodePage    | /tms/fleet/logistic-node | tms/fleet/index      |
| RealtimeVehiclePage | /tms/monitoring/realtime | tms/monitoring/index |
| VehicleTrackPage    | /tms/monitoring/track    | tms/monitoring/index |

后台菜单应使用上表的路由和组件路径；`src/router/modules/tms.ts` 可作为菜单层级参考。当前路由入口仅加载首页静态路由，其余菜单由后端返回，本次保留此机制。

## 公共组件

- `components/Tms/BusinessDialog.vue`：统一弹窗标题、关闭行为、保存状态、只读模式与页脚插槽。
- `components/Tms/BusinessDrawer.vue`：统一详情抽屉、加载状态与页脚插槽。
- `components/Tms/StatusTag.vue`：场景与排队号状态。
- `components/Tms/AmapView.vue`：在线车辆、轨迹显示、播放位置及节点选点，卸载时销毁地图。
- `fleet/components/FleetFormFields.vue`：表单字段、枚举、数值、日期、承运商选择。
- 场景编辑、场景详情、记录详情、车队编辑、司机扫码绑定分别独立为业务组件。

## 功能

- 场景分页筛选、编辑及号型配置、只读号型详情，保留编辑时号型ID和扩展配置。
- 叫号台资源选择、等待/叫号/使用状态、倒计时、自动刷新、完成后自动叫下一位、超时处理、取消原因。
- 排队记录分页、状态/号码/日期筛选、详情与审计日志；模拟取号展示各号型等待人数。
- 司机、承运商、车辆、物流节点分页及完整编辑字段，兼容后端枚举名和数字编码。
- 司机微信扫码填充资料、绑定二维码、资料同步、关注状态；模拟公众号消息仅在开发模式显示。
- 节点行政区划级联、后端地址解析和地图选点。
- 在线车辆地图及定位，轨迹时间筛选、播放/暂停/倍速/进度控制。车辆轨迹自动抽稀：不超过 2000 点时全部返回，超过时增大取点间隔并保留起终点，无需输入点数；单次查询最长 24 小时。
- 司机手机号、身份证号、驾驶证号由后端脱敏；“查看原文”单独请求权限接口，权限标识 `tms:driver:sensitive:view`。在系统管理的角色菜单权限中勾选司机管理下的“查看司机敏感信息”，保存后重新登录刷新前端权限。普通接口始终脱敏，编辑保存会保留未修改的原始号码。本次是显示及接口脱敏，未改变数据库存储加密方式。

## 配置和验证

地图需要在 `.env.local` 配置 `VITE_AMAP_WEB_KEY` 和 `VITE_AMAP_SECURITY_JS_CODE`，参见 `.env.local.example`。未配置时显示原因，表格和后端地址解析仍可使用。

验证命令：

```sh
node --test scripts/tms-migration.test.mjs
pnpm typecheck
pnpm exec eslint src/components/Tms src/views/tms
pnpm exec vite build
```

回归测试覆盖枚举空值及编码、筛选参数、资源分配、自动叫号、轨迹时间与采样参数、后端校验失败。微信授权、高德真实地图和后端业务流程仍需在配置有效服务的环境中联调。原 tms-react 暂时保留，便于对照和联调验收。
