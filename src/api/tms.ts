import { http } from "@/utils/http";

/** 后端统一返回结构，code=0 表示成功 */
export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

/** MyBatis-Plus IPage 返回结构 */
export interface PageResult<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
}

async function request<T>(
  method: "get" | "post" | "delete",
  url: string,
  data?: object,
  params?: object
): Promise<T> {
  const result = await http.request<Result<T>>(method, `/api${url}`, {
    data,
    params
  });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}

const get = <T>(url: string, params?: object) =>
  request<T>("get", url, undefined, params);
const post = <T>(url: string, data?: object, params?: object) =>
  request<T>("post", url, data, params);
const del = <T>(url: string) => request<T>("delete", url);

// ==================== 车队资料：承运商 / 车辆 / 物流节点 ====================

export interface Carrier {
  id: string;
  name: string;
  abbrName?: string;
  unifiedSocialCreditCode?: string;
  /** 列表可能返回编码或枚举名，表单提交统一用编码 */
  carrierType?: string | number;
  status?: string | number;
  contactPerson?: string;
  contactPhone?: string;
  cooperationStartDate?: string;
  cooperationEndDate?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType?: string | number;
  loadCapacity?: number;
  volumeCapacity?: number;
  vehicleLength?: number;
  status?: string | number;
  carrierId?: string;
  purchaseDate?: string;
  inspectionExpiryDate?: string;
  insuranceExpiryDate?: string;
}

export interface NodeAddress {
  formattedAddress?: string;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  adCode?: string;
}

export interface LogisticNode {
  id: string;
  name: string;
  abbrName: string;
  nodeType: string | number;
  cityIp: string;
  longitude: number;
  latitude: number;
  address?: NodeAddress;
  /** 后端分页 DTO 为平铺字段，page 里归一成嵌套 address */
  formattedAddress?: string;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  adCode?: string;
}

export interface GeocodedAddress {
  longitude: number;
  latitude: number;
  address: NodeAddress;
}

export const carrierApi = {
  page: (query: object) => post<PageResult<Carrier>>("/carriers/page", query),
  save: (data: object) => post<void>("/carriers/saveOrUpdate", data),
  remove: (id: string) => del<void>(`/carriers/delete/${id}`),
  get: (id: string) => get<Carrier>(`/carriers/${id}`)
};

export const vehicleApi = {
  page: (query: object) => post<PageResult<Vehicle>>("/vehicles/page", query),
  save: (data: object) => post<void>("/vehicles/saveOrUpdate", data),
  remove: (id: string) => del<void>(`/vehicles/delete/${id}`),
  get: (id: string) => get<Vehicle>(`/vehicles/${id}`)
};

export const logisticNodeApi = {
  page: async (query: object) => {
    const page = await post<PageResult<LogisticNode>>(
      "/logisticNode/page",
      query
    );
    // 后端分页 DTO 为平铺字段，这里归一成 UI 使用的嵌套 address 结构
    return {
      ...page,
      records: (page.records ?? []).map(row => ({
        ...row,
        address: {
          formattedAddress: row.formattedAddress,
          country: row.country,
          province: row.province,
          city: row.city,
          district: row.district,
          adCode: row.adCode
        }
      }))
    };
  },
  save: (data: object) => post<void>("/logisticNode/saveOrUpdate", data),
  remove: (id: string) => del<void>(`/logisticNode/delete/${id}`),
  get: (id: string) => get<LogisticNode>(`/logisticNode/${id}`),
  /** 按行政区划 + 详细地址从高德解析坐标（后端转发，无需浏览器地图） */
  geocode: (data: object) =>
    post<GeocodedAddress>("/logisticNode/geocode", data)
};

// ==================== 车辆监控 ====================

export interface VehicleLocation {
  locationId: string;
  vehicleId: string;
  plateNumber?: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  direction?: number;
  altitude?: number;
  accuracyMeters?: number;
  provider?: string;
  gpsTime: number;
}

export interface VehicleTrackResult {
  locations: VehicleLocation[];
  originalCount: number;
  returnedCount: number;
  sampled: boolean;
}

export const vehicleTrackApi = {
  online: () => get<VehicleLocation[]>("/monitoring/vehicle-location/online"),
  track: (
    vehicleId: string,
    startTime: number,
    endTime: number,
    maxPoints = 0
  ) =>
    get<VehicleTrackResult>(
      `/monitoring/vehicle-location/vehicle/${vehicleId}/track`,
      { startTime, endTime, maxPoints }
    )
};

// ==================== 排队叫号 ====================

/** 排队号型，如 2人桌 / 4人桌 / 8米车 */
export interface QueueTicketType {
  ticketTypeId?: string;
  queueId?: string;
  ticketTypeName: string;
  /** 号码前缀 1-8 位纯字母，如 A */
  prefix: string;
  /** 号码数字最小位数，如 3 生成 A001 */
  sequenceLength?: number;
  /** true=每天从001重置，false=永久累加 */
  dailyReset?: boolean;
  sortNo?: number;
  /** 1=启用 0=停用 */
  status?: number;
  extConfig?: string;
  nextSequence?: number;
  createTime?: number;
  updateTime?: number;
}

/** 排队场景 */
export interface QueueConfig {
  queueId: string;
  queueCode: string;
  queueName: string;
  sceneCode?: string;
  /** 叫号后允许使用的秒数，默认 300 */
  callTimeoutSeconds?: number;
  /** 过号后往后跳的位置数，默认 3 */
  deferredPosition?: number;
  /** 最大叫号次数，默认 2 */
  maxCallCount?: number;
  /** 1=启用 0=停用 */
  status?: number;
  remark?: string;
  createTime?: number;
  updateTime?: number;
  ticketTypes: QueueTicketType[];
}

/** 排队号状态：10 排队中 20 已叫号 30 使用中 40 已完成 50 已取消 */
export type TicketStatus = 10 | 20 | 30 | 40 | 50;

export interface QueueTicket {
  ticketId: string;
  queueId: string;
  ticketTypeId: string;
  ticketNo: string;
  sequenceNo?: number;
  /** ALL=不按天重置，否则 yyyy-MM-dd */
  businessDate?: string;
  status: TicketStatus;
  callCount?: number;
  queueOrder?: number;
  resourceId?: string;
  userId?: string;
  calledTime?: number;
  callDeadlineTime?: number;
  startUseTime?: number;
  finishTime?: number;
  cancelReason?: string;
  extConfig?: string;
  createTime?: number;
  updateTime?: number;
}

/** 排队资源：桌台 / 柜台 / 月台 */
export interface QueueResource {
  resourceId: string;
  queueId: string;
  ticketTypeId?: string;
  resourceNo?: string;
  resourceName?: string;
  extConfig?: string;
  status?: number;
  createTime?: number;
  updateTime?: number;
}

/** 排队号状态流转审计日志 */
export interface QueueTicketLog {
  logId: string;
  ticketId: string;
  queueId?: string;
  ticketTypeId?: string;
  ticketNo?: string;
  /** TAKE / CALL / START_USE / COMPLETE / CANCEL / TIMEOUT_DEFER / TIMEOUT_CANCEL / STATUS_CHANGE */
  eventType: string;
  fromStatus?: number;
  toStatus?: number;
  resourceId?: string;
  operator?: string;
  detail?: string;
  eventTime?: number;
  createTime?: number;
}

export interface QueuePageQuery {
  pageNum: number;
  pageSize: number;
  queueCode?: string;
  queueName?: string;
  sceneCode?: string;
  status?: number;
}

export interface QueueTicketPageQuery {
  pageNum: number;
  pageSize: number;
  queueId?: string;
  ticketTypeId?: string;
  ticketNo?: string;
  /** yyyy-MM-dd */
  businessDate?: string;
  status?: number;
  /** 优先于 status */
  statuses?: number[];
}

/** 完成使用的返回：ticket 当前号，nextTicket 自动叫到的下一个号 */
export interface CompleteResult {
  ticket: QueueTicket | null;
  nextTicket: QueueTicket | null;
}

// 后端实体状态为枚举，Jackson 默认按名称序列化（如 WAITING），部分接口返回编码（如 10），此处统一归一为编码
const TICKET_STATUS_BY_NAME: Record<string, number> = {
  WAITING: 10,
  CALLING: 20,
  IN_USE: 30,
  COMPLETED: 40,
  CANCELLED: 50
};

const CONFIG_STATUS_BY_NAME: Record<string, number> = {
  ENABLED: 1,
  DISABLED: 0
};

function normalizeStatus(
  value: unknown,
  byName: Record<string, number>
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const name = String(value).toUpperCase();
  return (
    byName[name] ?? (Number.isNaN(Number(name)) ? undefined : Number(name))
  );
}

function normalizeConfig(config: QueueConfig): QueueConfig {
  return {
    ...config,
    status: normalizeStatus(config.status, CONFIG_STATUS_BY_NAME)
  };
}

function normalizeTicket(ticket: QueueTicket): QueueTicket {
  return {
    ...ticket,
    status: normalizeStatus(
      ticket.status,
      TICKET_STATUS_BY_NAME
    ) as TicketStatus
  };
}

export const queueConfigApi = {
  /** 分页查询排队场景 */
  page: async (query: QueuePageQuery) => {
    const page = await post<PageResult<QueueConfig>>(
      "/queue/config/page",
      query
    );
    return { ...page, records: (page.records ?? []).map(normalizeConfig) };
  },
  findById: async (queueId: string) =>
    normalizeConfig(await get<QueueConfig>(`/queue/config/${queueId}`)),
  findByCode: async (queueCode: string) =>
    normalizeConfig(
      await get<QueueConfig>(`/queue/config/findByCode/${queueCode}`)
    ),
  /** queueId 为空创建，否则更新；号型列表以本次提交为准 */
  saveOrUpdate: (cmd: object) =>
    post<boolean>("/queue/config/saveOrUpdate", cmd),
  /** 查询启用中的号型 */
  findEnabledTicketTypes: (queueId: string) =>
    get<QueueTicketType[]>(`/queue/config/ticketTypes/${queueId}`)
};

export const queueTicketApi = {
  /** 用户取号 */
  take: async (cmd: object) =>
    normalizeTicket(await post<QueueTicket>("/queue/ticket/take", cmd)),
  /** 资源叫下一个号 */
  callNext: async (
    queueId: string,
    ticketTypeId: string,
    resourceId?: string
  ) =>
    normalizeTicket(
      await post<QueueTicket>(
        `/queue/ticket/callNext/${queueId}/${ticketTypeId}`,
        undefined,
        resourceId ? { resourceId } : undefined
      )
    ),
  /** 开始使用 */
  startUse: async (ticketId: string, resourceId?: string) =>
    normalizeTicket(
      await post<QueueTicket>(
        `/queue/ticket/startUse/${ticketId}`,
        undefined,
        resourceId ? { resourceId } : undefined
      )
    ),
  /** 完成使用 */
  complete: async (cmd: object) => {
    const result = await post<CompleteResult>("/queue/ticket/complete", cmd);
    return {
      ticket: result.ticket ? normalizeTicket(result.ticket) : null,
      nextTicket: result.nextTicket ? normalizeTicket(result.nextTicket) : null
    };
  },
  /** 取消排队号 */
  cancel: async (ticketId: string, reason?: string) =>
    normalizeTicket(
      await post<QueueTicket>(
        `/queue/ticket/cancel/${ticketId}`,
        undefined,
        reason ? { reason } : undefined
      )
    ),
  findById: async (ticketId: string) =>
    normalizeTicket(await get<QueueTicket>(`/queue/ticket/${ticketId}`)),
  /** 分页查询排队号 */
  page: async (query: QueueTicketPageQuery) => {
    const page = await post<PageResult<QueueTicket>>(
      "/queue/ticket/page",
      query
    );
    return { ...page, records: (page.records ?? []).map(normalizeTicket) };
  },
  /** 查询当前等待队列 */
  waiting: async (queueId: string, ticketTypeId: string) =>
    (
      await get<QueueTicket[]>(
        `/queue/ticket/waiting/${queueId}/${ticketTypeId}`
      )
    ).map(normalizeTicket),
  /** 立即处理所有已超时的叫号 */
  processExpired: () => post<number>("/queue/ticket/processExpired"),
  /** 查询排队号审计日志 */
  log: (ticketId: string) =>
    get<QueueTicketLog[]>(`/queue/ticket/log/${ticketId}`),
  /** 查询场景下所有资源 */
  resources: (queueId: string) =>
    get<QueueResource[]>(`/queue/ticket/resource/${queueId}`)
};

// ==================== 司机管理（含微信绑定） ====================

export interface Driver {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  driverLicense: string;
  driverType: string;
  status: string;
  qualificationCertificate: string;
  wechatOpenid: string;
  wechatNickname: string;
  wechatAvatarUrl: string;
  wechatSex: number;
  wechatProvince: string;
  wechatCity: string;
  wechatUnionid: string;
  wechatSubscribed: boolean | null;
  wechatSubscribeTime: number | null;
}

export interface WxProfile {
  openid: string;
  nickname: string;
  headimgurl: string;
  sex: number;
  province: string;
  city: string;
  unionid: string;
}

export const driverApi = {
  sensitive: (id: string) =>
    get<{ phone?: string; idCard?: string; driverLicense?: string }>(
      `/drivers/${id}/sensitive`
    ),
  page: (query: object) => post<PageResult<Driver>>("/drivers/page", query),
  save: (data: object) => post<void>("/drivers/saveOrUpdate", data),
  remove: (id: string) => del<void>(`/drivers/delete/${id}`),
  get: (id: string) => get<Driver>(`/drivers/${id}`),
  /** 生成司机微信扫码绑定二维码 */
  bindQr: (id: string) =>
    get<{ bindUrl: string; driverName: string }>(`/drivers/bind-qr/${id}`),
  /** 创建「扫码填充微信资料」任务 */
  profileFillToken: () =>
    post<{ fillToken: string; fillUrl: string }>("/drivers/profile-fill-token"),
  /** 轮询扫码填充结果 */
  profileFill: (token: string) =>
    get<{ status: string; profile?: WxProfile }>(
      `/drivers/profile-fill/${token}`
    ),
  /** 从公众号拉取最新微信资料 */
  syncWechatProfile: (id: string) =>
    post<void>(`/drivers/${id}/sync-wechat-profile`),
  /** 查询公众号关注状态 */
  subscribeStatus: (id: string) =>
    get<{ bound: boolean; subscribed: boolean }>(
      `/drivers/${id}/subscribe-status`
    )
};

/** 本地模拟司机在公众号回复手机号完成关注绑定 */
export const mockWechatApi = {
  mpMessage: (data: { openid: string; content: string }) =>
    post<{ reply: string; pushed?: boolean; pushError?: string }>(
      "/mock/wechat/mp-message",
      data
    )
};

// ==================== 通用 ====================

/** 后端时间戳为毫秒，空值返回 '-' */
export function formatTime(ms?: number | null): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}
