export const statusLabels: Record<number, string> = {
  10: "已揽收/入库",
  20: "运输中",
  30: "已到达目的网点",
  40: "末端配送中",
  50: "已签收",
  99: "已作废"
};

export const statusTagTypes: Record<number, string> = {
  10: "primary",
  20: "warning",
  30: "warning",
  40: "primary",
  50: "success",
  99: "info"
};

export const pickupTypeLabels: Record<number, string> = {
  1: "上门取件",
  2: "自送驿站"
};

/** 整车直发 / 零担拼车（网络拼车）。 */
export const transportModeLabels: Record<string, string> = {
  DIRECT: "整车直发",
  NETWORK: "零担拼车"
};

export const transportModeTagTypes: Record<string, string> = {
  DIRECT: "success",
  NETWORK: "warning"
};

export const handoverStatusLabels: Record<number, string> = {
  10: "已创建",
  20: "已发车",
  30: "已到达",
  40: "已接收",
  99: "已作废"
};

export { formatWeight, formatVolume } from "../order/presentation";
