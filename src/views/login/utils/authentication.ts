import { http } from "@/utils/http";
import type { UserResult } from "@/api/user";
import { setToken, removeToken } from "@/utils/auth";
import { storageLocal } from "@pureadmin/utils";
import { router } from "@/router";
import { initRouter, getTopMenu } from "@/router/utils";
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
    await router.push(getTopMenu(true)?.path || "/welcome");
    message(transformI18n("login.pureLoginSuccess"), { type: "success" });
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      removeToken();
      throw error;
    }
    // 登录和菜单加载是两个独立结果。认证已经成功时，不能因为某一条后台菜单
    // 配置错误就删除令牌并把用户留在登录页；至少允许进入静态首页继续操作。
    console.error("动态菜单加载失败", error);
    await router.replace({ path: "/welcome", query: { login: Date.now() } });
    message(`登录成功，但动态菜单加载失败：${error.message || "菜单配置异常"}`, {
      type: "warning",
      duration: 6000
    });
  }
}
