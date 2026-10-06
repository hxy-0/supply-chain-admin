const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const axios = require("axios");

// 执行实际 HTTP 模块及 Axios 拦截器，仅替换存储、界面通知和网络适配器。
function setup(options = {}) {
  let token = {
    accessToken: "old-access",
    refreshToken: "refresh",
    expires: Date.now() + 600000,
    refreshExpires: Date.now() + 3600000,
    ...options.token
  };
  let refreshes = 0;
  let logouts = 0;
  const calls = [];
  let http;
  const events = {};
  let tick;
  const document = {
    visibilityState: options.hidden ? "hidden" : "visible",
    addEventListener(name, callback) {
      events[name] = callback;
    }
  };
  const window = {
    setInterval(callback) {
      tick = callback;
    },
    addEventListener(name, callback) {
      events[name] = callback;
    }
  };
  const store = {
    logOut() {
      logouts++;
      token = null;
    },
    async handRefreshToken(data) {
      const response = await http.request("post", "/auth/refresh-token", {
        data
      });
      if (response.code !== 0)
        throw Object.assign(new Error(response.message), {
          code: response.code
        });
      token = response.data;
      return response;
    }
  };
  function reject(config, status) {
    throw new axios.AxiosError(
      "Request failed",
      "ERR_BAD_RESPONSE",
      config,
      null,
      {
        status,
        data: { code: status },
        config,
        headers: {},
        statusText: "Error"
      }
    );
  }
  const adapter = async config => {
    calls.push({
      url: config.url,
      authorization: config.headers.Authorization,
      data: config.data
    });
    if (config.url === "/auth/refresh-token") {
      refreshes++;
      if (options.refreshGate) await options.refreshGate;
      if (options.refreshNetworkError) throw new Error("Network error");
      if (options.refreshStatus) reject(config, options.refreshStatus);
      return {
        config,
        status: 200,
        headers: {},
        data: options.refreshBody || {
          code: 0,
          data: {
            ...token,
            accessToken: "new-access",
            refreshToken: "rotated-refresh",
            expires: Date.now() + 600000
          }
        }
      };
    }
    if (
      options.delayOld &&
      config.headers.Authorization === "Bearer old-access"
    )
      await options.delayOld(config);
    if (
      options.always401 ||
      config.url === "/auth/login" ||
      config.headers.Authorization !== "Bearer new-access"
    )
      reject(config, 401);
    return { config, status: 200, headers: {}, data: { code: 0, data: "ok" } };
  };
  const imports = {
    axios: {
      __esModule: true,
      default: {
        isCancel: axios.isCancel,
        create: config => axios.create({ ...config, adapter })
      }
    },
    qs: require("qs"),
    "@/utils/message": { message() {} },
    "@/plugins/i18n": { $t: value => value, transformI18n: value => value },
    "@/utils/auth": {
      getToken: () => token,
      formatToken: value => "Bearer " + value
    },
    "@/store/modules/user": { useUserStoreHook: () => store }
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../src/utils/http/index.ts"),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", "document", compiled)(
    name => {
      assert.ok(name in imports, "Unexpected import: " + name);
      return imports[name];
    },
    module,
    module.exports,
    window,
    document
  );
  http = module.exports.http;
  return {
    tick: () => tick(),
    document,
    events,
    http,
    calls,
    get token() {
      return token;
    },
    get refreshes() {
      return refreshes;
    },
    get logouts() {
      return logouts;
    }
  };
}

test("401 refreshes valid session and retries original method and payload", async () => {
  const state = setup();
  assert.equal(
    (await state.http.request("post", "/protected", { data: { value: 3 } }))
      .data,
    "ok"
  );
  assert.equal(state.refreshes, 1);
  assert.equal(state.logouts, 0);
  assert.equal(state.calls[2].authorization, "Bearer new-access");
  assert.equal(state.calls[2].data, state.calls[0].data);
});

test("idle page registers no timer or visibility listeners even near expiry", async () => {
  const state = setup({ token: { expires: Date.now() + 45000 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(state.events, {});
  assert.equal(state.refreshes, 0);
  assert.equal(state.calls.length, 0);
  assert.throws(() => state.tick(), TypeError);
});

test("concurrent 401 responses share one refresh", async () => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const state = setup({ refreshGate: gate });
  const results = Promise.all([
    state.http.request("get", "/one"),
    state.http.request("get", "/two")
  ]);
  await new Promise(resolve => setImmediate(resolve));
  release();
  await results;
  assert.equal(state.refreshes, 1);
});

test("late 401 from old token reuses already refreshed access token", async () => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const state = setup({
    delayOld: config => (config.url === "/late" ? gate : undefined)
  });
  const late = state.http.request("get", "/late");
  await state.http.request("get", "/first");
  release();
  await late;
  assert.equal(state.refreshes, 1);
});

test("expired refresh token logs out without attempting refresh", async () => {
  const state = setup({ token: { refreshExpires: Date.now() - 1 } });
  await assert.rejects(state.http.request("get", "/protected"));
  assert.equal(state.refreshes, 0);
  assert.equal(state.logouts, 1);
});

test("rejected refresh logs out and does not replay protected request", async () => {
  const state = setup({ refreshStatus: 401 });
  await assert.rejects(state.http.request("get", "/protected"));
  assert.equal(state.refreshes, 1);
  assert.equal(state.logouts, 1);
  assert.equal(state.calls.length, 2);
});

test("network failure during refresh retains session", async () => {
  const state = setup({ refreshNetworkError: true });
  await assert.rejects(state.http.request("get", "/protected"));
  assert.equal(state.logouts, 0);
  assert.ok(state.token);
});

test("second 401 stops after one replay", async () => {
  const state = setup({ always401: true });
  await assert.rejects(state.http.request("get", "/protected"));
  assert.equal(state.refreshes, 1);
  assert.equal(state.calls.length, 3);
  assert.equal(state.logouts, 1);
});

test("public login rejection never triggers token refresh", async () => {
  const state = setup();
  await assert.rejects(state.http.request("post", "/auth/login"));
  assert.equal(state.refreshes, 0);
  assert.equal(state.logouts, 0);
});

test("request preflight refreshes expiring access token", async () => {
  const state = setup({ token: { expires: Date.now() + 45000 } });
  await state.http.request("get", "/protected");
  assert.equal(state.refreshes, 1);
  assert.equal(state.calls.length, 2);
});

test("refresh rejection in response body preserves status code for logout", async () => {
  const state = setup({ refreshBody: { code: 401, message: "会话失效" } });
  await assert.rejects(state.http.request("get", "/protected"));
  assert.equal(state.logouts, 1);
});
