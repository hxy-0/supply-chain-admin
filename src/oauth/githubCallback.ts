/** 在路由初始化前接收 OAuth 回调，并立即移除地址栏中的授权码。 */
function captureCallback() {
  const provider = {
    "/oauth/github/callback": "github",
    "/oauth/feishu/callback": "feishu"
  }[window.location.pathname];
  if (!provider) {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const result = {
    provider,
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error")
  };
  const historyMode = import.meta.env.VITE_ROUTER_HISTORY || "hash";
  const loginUrl = historyMode.startsWith("h5")
    ? "/oauth/callback"
    : "/#/oauth/callback";
  window.history.replaceState(null, "", loginUrl);
  return result;
}

let callback = captureCallback();

export function consumeGithubCallback() {
  const result = callback;
  callback = null;
  return result;
}
