const sdkUrl =
  "https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js";

export interface FeishuQrInstance {
  matchOrigin(origin: string): boolean;
  matchData(data: unknown): boolean;
}

export type FeishuQrFactory = (options: {
  id: string;
  goto: string;
  width: string;
  height: string;
  style?: string;
}) => FeishuQrInstance;

declare global {
  interface Window {
    QRLogin?: FeishuQrFactory;
  }
}

let sdkPromise: Promise<FeishuQrFactory> | undefined;

/** 按需加载官方 SDK，失败后允许重试，多个组件共享一次加载。 */
export function loadFeishuQrSdk(): Promise<FeishuQrFactory> {
  if (window.QRLogin) return Promise.resolve(window.QRLogin);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FeishuQrFactory>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(fail, 15_000);
    function fail() {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      reject(new Error("Feishu QR SDK could not be loaded"));
    }
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => {
      if (!window.QRLogin) return fail();
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      resolve(window.QRLogin);
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

export function parseFeishuQrAuthorizationUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.origin !== "https://passport.feishu.cn" ||
    url.pathname !== "/suite/passport/oauth/authorize" ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.get("response_type") !== "code" ||
    !url.searchParams.get("client_id") ||
    !url.searchParams.get("redirect_uri") ||
    !url.searchParams.get("state")
  ) {
    throw new Error("Invalid Feishu QR authorization URL");
  }
  return url;
}

/** 只接受当前二维码 iframe 的消息，同时使用官方 SDK 的两项校验。 */
export function getFeishuQrRedirect(
  event: MessageEvent,
  instance: FeishuQrInstance,
  source: Window | null,
  authorizationUrl: string
): string | null {
  if (
    !source ||
    event.source !== source ||
    !instance.matchOrigin(event.origin) ||
    !instance.matchData(event.data) ||
    typeof event.data?.tmp_code !== "string" ||
    !event.data.tmp_code.trim()
  ) {
    return null;
  }
  const url = parseFeishuQrAuthorizationUrl(authorizationUrl);
  url.searchParams.set("tmp_code", event.data.tmp_code);
  return url.toString();
}
