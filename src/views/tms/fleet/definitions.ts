export interface FleetOption {
  value: number;
  label: string;
  name?: string;
}
export interface FleetField {
  key: string;
  label: string;
  kind?: "number" | "date" | "select";
  required?: boolean;
  options?: FleetOption[];
  min?: number;
  max?: number;
  /** 列表列最小宽度，缺省 140 */
  tableMinWidth?: number;
}
const options = (labels: string[], names: string[], start = 0): FleetOption[] =>
  labels.map((label, i) => ({ label, value: i + start, name: names[i] }));
export const driverTypes = options(
  ["自有司机", "外协司机", "临时司机"],
  ["OWNED", "CONTRACTED", "TEMPORARY"]
);
export const driverStatuses = options(
  ["启用", "禁用"],
  ["ENABLED", "DISABLED"]
);
export const carrierTypes = options(
  ["自有车队", "合同承运商", "临时承运商"],
  ["OWNED", "CONTRACT", "TEMPORARY"]
);
export const carrierStatuses = options(
  ["合作中", "暂停合作", "终止合作"],
  ["ACTIVE", "SUSPENDED", "TERMINATED"]
);
export const vehicleTypes = options(
  ["厢式货车", "平板车", "冷藏车", "危险品车", "集装箱车"],
  ["VAN", "FLATBED", "REFRIGERATED", "HAZMAT", "CONTAINER"]
);
export const vehicleStatuses = options(
  ["正常", "维修中", "不可用", "已报废"],
  ["NORMAL", "MAINTENANCE", "UNAVAILABLE", "SCRAPPED"]
);
export const nodeTypes = options(
  ["DC仓", "TC仓", "前置仓", "供应商提货点", "外部地址", "末端网点", "驿站"],
  [
    "DC_WAREHOUSE",
    "TC_WAREHOUSE",
    "FRONT_WAREHOUSE",
    "SUPPLIER_PICKUP_POINT",
    "EXTERNAL_ADDRESS",
    "EXPRESS_BRANCH",
    "STATION"
  ],
  1
);
export type FleetKind = "drivers" | "carriers" | "vehicles" | "logisticNode";
export const definitions: Record<
  FleetKind,
  {
    title: string;
    filters: string[];
    fields: FleetField[];
    defaults: Record<string, unknown>;
  }
> = {
  drivers: {
    title: "司机",
    filters: ["name", "driverType", "status"],
    defaults: { driverType: 0, status: 0 },
    fields: [
      { key: "name", label: "姓名", required: true, tableMinWidth: 100 },
      { key: "phone", label: "手机号", required: true, tableMinWidth: 140 },
      {
        key: "driverType",
        tableMinWidth: 110,
        label: "司机类型",
        kind: "select",
        options: driverTypes
      },
      {
        key: "status",
        label: "状态",
        kind: "select",
        options: driverStatuses,
        tableMinWidth: 80
      },
      { key: "idCard", label: "身份证号", tableMinWidth: 210 },
      { key: "driverLicense", label: "驾驶证号", tableMinWidth: 210 },
      {
        key: "qualificationCertificate",
        label: "从业资格证",
        tableMinWidth: 210
      }
    ]
  },
  carriers: {
    title: "承运商",
    filters: ["name", "contactPerson", "carrierType", "status"],
    defaults: { carrierType: 1, status: 0 },
    fields: [
      { key: "name", label: "名称", required: true },
      { key: "abbrName", label: "简称" },
      {
        key: "carrierType",
        label: "承运商类型",
        kind: "select",
        options: carrierTypes
      },
      {
        key: "status",
        label: "合作状态",
        tableMinWidth: 150,
        kind: "select",
        options: carrierStatuses
      },
      { key: "contactPerson", label: "联系人", tableMinWidth: 90 },
      { key: "contactPhone", label: "联系电话" },
      {
        key: "unifiedSocialCreditCode",
        label: "统一社会信用代码",
        tableMinWidth: 230
      },
      { key: "cooperationStartDate", label: "合作开始日期", kind: "date" },
      { key: "cooperationEndDate", label: "合作结束日期", kind: "date" }
    ]
  },
  vehicles: {
    title: "车辆",
    filters: ["plateNumber", "carrierId", "vehicleType", "status"],
    defaults: { vehicleType: 0, status: 0 },
    fields: [
      { key: "plateNumber", label: "车牌号", required: true },
      { key: "carrierId", label: "所属承运商", kind: "select" },
      {
        key: "vehicleType",
        label: "车辆类型",
        kind: "select",
        options: vehicleTypes
      },
      {
        key: "status",
        label: "车辆状态",
        kind: "select",
        options: vehicleStatuses
      },
      { key: "vehicleLength", label: "长度（米）", kind: "number", min: 0.01 },
      { key: "loadCapacity", label: "载重（吨）", kind: "number", min: 0 },
      {
        key: "volumeCapacity",
        label: "容积（立方米）",
        kind: "number",
        min: 0
      },
      { key: "purchaseDate", label: "购买日期", kind: "date" },
      { key: "inspectionExpiryDate", label: "年检到期日", kind: "date" },
      { key: "insuranceExpiryDate", label: "保险到期日", kind: "date" }
    ]
  },
  logisticNode: {
    title: "物流节点",
    filters: ["name", "abbrName", "cityIp", "nodeType"],
    defaults: { nodeType: 6, country: "中国" },
    fields: [
      { key: "name", label: "名称", required: true, tableMinWidth: 140 },
      { key: "abbrName", label: "简称", required: true, tableMinWidth: 100 },
      {
        key: "nodeType",
        label: "节点类型",
        kind: "select",
        options: nodeTypes,
        required: true,
        tableMinWidth: 100
      },
      { key: "cityIp", label: "城市编码", required: true, tableMinWidth: 100 },
      {
        key: "longitude",
        label: "经度",
        kind: "number",
        min: -180,
        max: 180,
        required: true
      },
      {
        key: "latitude",
        label: "纬度",
        kind: "number",
        min: -90,
        max: 90,
        required: true
      }
    ]
  }
};
export function enumCode(value: unknown, list: FleetOption[]) {
  if (value == null || value === "") return undefined;
  return list.find(o => o.name === value || o.value === Number(value))?.value;
}
export function optionLabel(value: unknown, list: FleetOption[]) {
  const code = enumCode(value, list);
  return list.find(o => o.value === code)?.label || "-";
}
