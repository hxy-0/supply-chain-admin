import AMapLoader from "@amap/amap-jsapi-loader";

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

let loader: Promise<any> | null = null;

export function loadAmap(): Promise<any> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loader) return loader;

  const key = import.meta.env.VITE_AMAP_WEB_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
  if (!key || !securityJsCode) {
    return Promise.reject(new Error("高德地图 Key 或安全密钥未配置"));
  }
  window._AMapSecurityConfig = { securityJsCode };
  loader = AMapLoader.load({
    key,
    version: "2.0",
    plugins: [
      "AMap.Scale",
      "AMap.ToolBar",
      "AMap.Geocoder",
      "AMap.PlaceSearch",
      "AMap.CitySearch"
    ]
  }).catch(error => {
    loader = null;
    throw error;
  });
  return loader;
}
