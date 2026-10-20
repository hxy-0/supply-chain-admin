import { http } from "@/utils/http";
import type { UserResult } from "@/api/user";
import { setToken, removeToken } from "@/utils/auth";
import { storageLocal } from "@pureadmin/utils";
import { router } from "@/router";
import { initRouter, getTopMenu } from "@/router/utils";
import { loginDestination, lastPageKey } from "@/router/sessionRoute";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";

export async function authRequest<T = UserResult["data"]>(
  path: string,
  data?: object
): Promise<T> {
  try {
    const response = await http.request<{
      code: number;
      message: string;
      data: T;
    }>("post", `/auth${path}`, { data });
    if (response.code !== 0) throw new Error(response.message);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || error.message || "请求失败，请稍后重试"
    );
  }
}
export async function completeLogin(data: UserResult["data"]) {
  storageLocal().removeItem("async-routes");
  setToken(data);
  try {
    await initRouter();
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      removeToken();
      throw error;
    }
    throw new Error(`菜单加载失败：${error.message || "请稍后重试"}`);
  }
  const destination = loginDestination(
    router.currentRoute.value.query.redirect,
    storageLocal().getItem(lastPageKey(data.username || ""))
  );
  const navigationFailure = await router.push(
    router.resolve(destination).name &&
      router.resolve(destination).name !== "PageNotFound"
      ? destination
      : getTopMenu(true)?.path || "/welcome"
  );
  if (navigationFailure || router.currentRoute.value.path === "/login") {
    throw new Error("登录已验证，但页面跳转未完成，请重试");
  }
  message(transformI18n("login.pureLoginSuccess"), { type: "success" });
}
