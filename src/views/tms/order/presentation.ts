export const statusLabels: Record<number, string> = {
  10: "待提货",
  15: "部分提货",
  20: "待发运",
  25: "运输中",
  30: "已完成",
  99: "已取消"
};
export const formatWeight = (value?: number) =>
  value == null ? "—" : Number(value).toFixed(3);
export const formatVolume = (value?: number) =>
  value == null ? "—" : (Number(value) / 1_000_000).toFixed(2);
