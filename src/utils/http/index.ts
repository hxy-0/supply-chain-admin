import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { message } from "@/utils/message";
import { $t, transformI18n } from "@/plugins/i18n";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 请求超时时间
  timeout: 10000,
  // 跨源部署时携带 Cookie（GitHub OAuth 浏览器绑定 Cookie 依赖）；后端 CORS 为白名单源 + allowCredentials
  withCredentials: true,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

class PureHttp {
  private static readonly refreshAheadMillis = 60_000;
  private static readonly publicEndpoints = new Set([
    "/auth/login",
    "/auth/refresh-token",
    "/auth/code",
    "/auth/code-login",
    "/auth/register",
    "/auth/reset-password",
    "/auth/github/authorize",
    "/auth/github/callback",
    "/auth/feishu/authorize",
    "/auth/feishu/callback",
    "/auth/logout"
  ]);
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  private static refreshPromise: Promise<string> | null = null;

  private static expireSession() {
    if (!getToken()) return;
    useUserStoreHook().logOut();
    message(transformI18n($t("login.pureLoginExpired")), { type: "warning" });
  }

  /** 请求前刷新和收到 401 后刷新共用同一任务，避免并发消费一次性刷新令牌。 */
  private static refreshAccessToken(): Promise<string> {
    if (PureHttp.refreshPromise) return PureHttp.refreshPromise;
    const data = getToken();
    if (
      !data?.refreshToken ||
      !Number.isFinite(Number(data.refreshExpires)) ||
      Number(data.refreshExpires) <= Date.now()
    ) {
      PureHttp.expireSession();
      return Promise.reject(new Error("登录已失效，请重新登录"));
    }
    PureHttp.refreshPromise = useUserStoreHook()
      .handRefreshToken({ refreshToken: data.refreshToken })
      .then(res => res.data.accessToken)
      .catch(error => {
        const status = error.response?.status ?? error.code;
        if (status === 401 || status === 403) PureHttp.expireSession();
        // 超时、断网及服务异常保留会话，让用户可以稍后重试。
        throw error;
      })
      .finally(() => {
        PureHttp.refreshPromise = null;
      });
    return PureHttp.refreshPromise;
  }

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        if (PureHttp.publicEndpoints.has(config.url)) {
          return config;
        }
        const data = getToken();
        if (!data) {
          return config;
        }
        if (
          !data.refreshToken ||
          !Number.isFinite(Number(data.refreshExpires)) ||
          Number(data.refreshExpires) <= Date.now()
        ) {
          PureHttp.expireSession();
          throw new Error("登录已失效，请重新登录");
        }
        if (Number(data.expires) <= Date.now() + PureHttp.refreshAheadMillis) {
          config.headers["Authorization"] = formatToken(
            await PureHttp.refreshAccessToken()
          );
        } else {
          config.headers["Authorization"] = formatToken(data.accessToken);
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      async (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);
        const config = error.config as PureHttpRequestConfig | undefined;
        if (
          error.response?.status === 401 &&
          config &&
          !PureHttp.publicEndpoints.has(config.url) &&
          !$error.isCancelRequest
        ) {
          if (config.authRetried) {
            PureHttp.expireSession();
            throw error;
          }
          const current = getToken();
          if (!current) throw error;
          config.authRetried = true;
          // 延迟返回的旧请求可以直接使用其他请求刚刷新的令牌。
          const failedAuthorization = config.headers?.Authorization;
          const accessToken =
            failedAuthorization !== formatToken(current.accessToken) &&
            Number(current.expires) > Date.now()
              ? current.accessToken
              : await PureHttp.refreshAccessToken();
          config.headers = {
            ...config.headers,
            Authorization: formatToken(accessToken)
          };
          return instance.request(config);
        }
        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
