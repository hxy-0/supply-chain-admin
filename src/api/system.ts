import { http } from "@/utils/http";
import { message } from "@/utils/message";

async function systemRequest<T extends { code: number; message: string }>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: object
): Promise<T> {
  try {
    const result = await http.request<T>(method, `/system${url}`, { data });
    if (result.code !== 0) {
      throw new Error(result.message);
    }
    return result;
  } catch (error) {
    message(error.response?.data?.message || error.message || "操作失败", {
      type: "error"
    });
    throw error;
  }
}

type Result = {
  code: number;
  message: string;
  data?: Array<any>;
};

type ResultTable = {
  code: number;
  message: string;
  data?: {
    list: Array<any>;
    total?: number;
    pageSize?: number;
    currentPage?: number;
  };
};

type ResultPage = {
  code: number;
  message: string;
  data?: {
    records: Array<any>;
    total: number;
    size: number;
    current: number;
    pages: number;
  };
};

/** 获取系统管理-用户管理列表 */
export const getUserList = (data?: object) => {
  return systemRequest<ResultPage>("post", "/users/query", data);
};

/** 系统管理-用户管理-获取所有角色列表 */
export const getAllRoleList = () => {
  return systemRequest<Result>("get", "/roles");
};

/** 系统管理-用户管理-根据userId，获取对应角色id列表（userId：用户id） */
export const getRoleIds = (data?: object) => {
  return systemRequest<Result>(
    "get",
    `/users/${(data as { userId: number }).userId}/roles`
  );
};

/** 获取系统管理-角色管理列表 */
export const getRoleList = (data?: object) => {
  return systemRequest<ResultPage>("post", "/roles/query", data);
};

/** 获取系统管理-菜单管理列表 */
export const getMenuList = (data?: object) => {
  return systemRequest<Result>("post", "/menus/query", data);
};

/** 获取系统管理-部门管理列表 */
export const getDeptList = (data?: object) => {
  return http.request<Result>("post", "/dept", { data });
};

/** 获取系统监控-在线用户列表 */
export const getOnlineLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/online-logs", { data });
};

/** 获取系统监控-登录日志列表 */
export const getLoginLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/login-logs", { data });
};

/** 获取系统监控-操作日志列表 */
export const getOperationLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/operation-logs", { data });
};

/** 获取系统监控-系统日志列表 */
export const getSystemLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/system-logs", { data });
};

/** 获取系统监控-系统日志-根据 id 查日志详情 */
export const getSystemLogsDetail = (data?: object) => {
  return http.request<Result>("post", "/system-logs-detail", { data });
};

/** 获取角色管理-权限-菜单权限 */
export const getRoleMenu = (data?: object) => {
  return systemRequest<Result>("post", "/menus/query", data);
};

/** 获取角色管理-权限-菜单权限-根据角色 id 查对应菜单 */
export const getRoleMenuIds = (data?: object) => {
  return systemRequest<Result>(
    "get",
    `/roles/${(data as { id: number }).id}/menus`
  );
};

export const saveSystemUser = (id: number | undefined, data: object) =>
  systemRequest(id ? "put" : "post", id ? `/users/${id}` : "/users", data);
export const setUserEnable = (id: number, isEnable: number) =>
  systemRequest("put", `/users/${id}/enable`, { isEnable });
export const deleteSystemUsers = (ids: number[]) =>
  systemRequest("post", "/users/delete", { ids });
export const resetSystemPassword = (id: number, password: string) =>
  systemRequest("put", `/users/${id}/password`, { password });
export const setSystemAvatar = (id: number, avatar: string) =>
  systemRequest("put", `/users/${id}/avatar`, { avatar });
export const setUserRoles = (id: number, ids: number[]) =>
  systemRequest("put", `/users/${id}/roles`, { ids });
export const saveSystemRole = (id: number | undefined, data: object) =>
  systemRequest(id ? "put" : "post", id ? `/roles/${id}` : "/roles", data);
export const setRoleEnable = (id: number, isEnable: number) =>
  systemRequest("put", `/roles/${id}/enable`, { isEnable });
export const deleteSystemRole = (id: number) =>
  systemRequest("delete", `/roles/${id}`);
export const setRoleMenus = (id: number, ids: number[]) =>
  systemRequest("put", `/roles/${id}/menus`, { ids });
export const saveSystemMenu = (id: number | undefined, data: object) =>
  systemRequest(
    id != null ? "put" : "post",
    id != null ? `/menus/${id}` : "/menus",
    data
  );
export const deleteSystemMenu = (id: number) =>
  systemRequest("delete", `/menus/${id}`);

export const reorderSystemMenus = (
  groups: { parentId: number; ids: number[]; expectedIds: number[] }[]
) => systemRequest("put", "/menus/order", { groups });
