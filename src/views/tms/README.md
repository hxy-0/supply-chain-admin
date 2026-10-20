# TMS 前端迁移

业务页面统一位于 `src/views/tms`，沿用 supply-chain-admin 的 Element Plus、HTTP 鉴权与后台动态菜单机制。

订单的发货人字段为 `senderName`（数据库 `sender_name`）；列表仅展示表格，状态支持多选，查询参数为 `statuses` 数组，空数组表示不限。状态统一为待揽收、运输中、已送达、已完成、已取消，按实际揽收及最终目的地到站、卸货事实计算。订单运输卡片和履约进度在订单详情查看。

订单 `/tms/order` 提供表格多选与“生成车次”：选择本次商品数量、提货点和承运商，整车生成提货点到订单目的地的直发车次；零担选择 DC/TC/前置转运仓，生成提货点到该仓的揽收车次。直接生成揽收任务和数量预留，不创建提货调度计划。请求数量保持十进制字符串；后台锁定订单重新核验可预留量，禁止混入其他订单行、超量或无效转运仓。

班次调度 `/tms/dispatch` 只组织班次货物：选择班次与承运商，复制完整班次节点时刻表；选择始发仓已就绪且未被其他车次占用的容器。下发锁定运输清单，未装运取消释放预留。菜单与结构应用 `20261011_order_split_dispatch.sql`；原计划来源记录保留，不删除订单、任务和实提事实。

揽收任务 `/tms/pickup` 支持任务详情、现场实提、少备结束和未执行取消。任务不依赖调度计划下发。角色控制查询和操作权限，任务列表不再按账号绑定的物流节点过滤。

车辆管理外层为查询列表，点“详情”打开档案与“运输与装载”页签。后者分页查询该车辆实际车次、路线和容器，未分配车辆显示空状态。派车和运输执行尚未完整接入，下文旧运单与小程序能力不能视为容器运输新模型已完成。

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

订单管理提供查询、详情及后台编辑、取消；仅未实提的待提货订单可代改或取消。履约管理目录（/tms/fulfillment）归拢订单管理、揽收任务与班次调度，位于运输管理之下。运单管理（/tms/waybill → `tms/waybill/index`）提供查询与详情，详情含实提 SKU 明细、运输段（整车直发/零担拼车）及轨迹；提货生成运单与装车调度在小程序办理。司机小程序提供实际提货、运单装车、整车直发、拼车、发车和到货清点。运行前需升级后端及 `trip_sheet.transport_mode` 字段。

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

## 工作空间界面

前三张参考图各包含两个界面，分别参考车辆与货物选择、调度工作台、车队概览、容器货物、路线规划、订单卡片与详情。系统画布取第四张平板屏幕内部的浅灰蓝，统一使用中文业务标签。

当前已接入订单卡片/列表切换、车辆选择与档案详情、提货容器选择与实际商品数量、调度任务与节点路线视图，以及监控与授权页面的统一工作空间样式。这些界面继续使用现有业务 API；调度统计明确区分筛选总数与当前分页数量。车辆图形为界面中的矢量示意，容器排列不代表实际装载位置。

调度甘特按任务停靠节点的计划到达、离站时间绘制；单个时间显示为时间点，缺失时间明确显示未设置，倒置时间提示检查计划。点击时间条可切换对应任务。配色使用蓝紫主色、青绿完成状态、琥珀待处理状态及红色取消状态；暗色模式也保留区分。

实时车辆页面加入车队运行总览：档案数量、在线定位数量、有行驶速度数量、车辆状态分布，以及年检和保险到期提醒。选择车辆同步切换档案和定位筛选；无 GPS 数据明确提示暂无在线定位。调度详情读取物流节点真实坐标，节点列表与地图双向选择；缺失坐标时提示缺失数量，不跨越缺失节点绘制路线。地图连线为节点顺序示意，实际道路轨迹仍通过车辆轨迹查看。

参考图中的三维装载、空间利用率和收益图表尚未实现；现有接口不足以支持真实数据时，不显示编造的指标。新组件渲染与空状态验证使用 `node --test scripts/tms-workspace.test.mjs scripts/tms-schedule.test.mjs scripts/tms-dashboard.test.mjs`。

地图需要在 `.env.local` 配置 `VITE_AMAP_WEB_KEY` 和 `VITE_AMAP_SECURITY_JS_CODE`，参见 `.env.local.example`。未配置时显示原因，表格和后端地址解析仍可使用。

验证命令：

```sh
node --test scripts/tms-migration.test.mjs
pnpm typecheck
pnpm exec eslint src/components/Tms src/views/tms
pnpm exec vite build
```

回归测试覆盖枚举空值及编码、筛选参数、资源分配、自动叫号、轨迹时间与采样参数、后端校验失败。微信授权、高德真实地图和后端业务流程仍需在配置有效服务的环境中联调。原 tms-react 暂时保留，便于对照和联调验收。

### 班次计划与派车的边界

线路班次配置维护节点及生成规则，具体班次按日期生成。班次计划按周一至周日表格展示，详情可调整经停和到发时间；承运商、车辆及司机在派车时指派，不属于班次配置或班次生成参数。重复生成保留已生成及已编辑的班次。
