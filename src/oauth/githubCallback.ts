/** 在路由初始化前接收无 hash 的 GitHub 回调，并立即移除地址栏中的授权码。 */
function captureCallback() {
  if (window.location.pathname !== "/oauth/github/callback") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const result = {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error")
  };
  const historyMode = import.meta.env.VITE_ROUTER_HISTORY || "hash";
  const loginUrl = historyMode.startsWith("h5") ? "/login" : "/#/login";
  window.history.replaceState(null, "", loginUrl);
  return result;
}

let callback = captureCallback();

export function consumeGithubCallback() {
  const result = callback;
  callback = null;
  return result;
}
