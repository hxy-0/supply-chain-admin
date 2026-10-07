import dayjs from "dayjs";

/** 时间戳（毫秒）→ `yyyy-MM-dd HH:mm:ss`，空/无效返回 "-" */
export function formatDateTime(value?: number | null) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : "-";
}
