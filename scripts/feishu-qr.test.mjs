import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getFeishuQrRedirect,
  parseFeishuQrAuthorizationUrl
} from "../src/views/login/utils/feishuQr.ts";

const authorizationUrl =
  "https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=app&redirect_uri=http%3A%2F%2F127.0.0.1%3A8848%2Foauth%2Ffeishu%2Fcallback&response_type=code&state=one-time-state";
const source = {};
const instance = {
  matchOrigin: origin => origin === "https://passport.feishu.cn",
  matchData: data => data?.marker === "sdk-valid"
};
const validEvent = {
  source,
  origin: "https://passport.feishu.cn",
  data: { marker: "sdk-valid", tmp_code: "temporary+code&state=attack" }
};

test("scan confirmation preserves state and safely encodes the temporary code", () => {
  const redirect = new URL(
    getFeishuQrRedirect(validEvent, instance, source, authorizationUrl)
  );
  assert.equal(redirect.origin, "https://passport.feishu.cn");
  assert.equal(redirect.searchParams.get("state"), "one-time-state");
  assert.equal(redirect.searchParams.get("tmp_code"), validEvent.data.tmp_code);
  assert.equal(redirect.searchParams.get("redirect_uri"), "http://127.0.0.1:8848/oauth/feishu/callback");
});

test("messages from another frame or an untrusted origin are ignored", () => {
  for (const event of [
    { ...validEvent, source: {} },
    { ...validEvent, origin: "https://attacker.example" },
    { ...validEvent, data: { tmp_code: "unverified" } },
    { ...validEvent, data: null },
    { ...validEvent, data: { marker: "sdk-valid", tmp_code: "" } },
    { ...validEvent, data: { marker: "sdk-valid", tmp_code: 42 } }
  ]) {
    assert.equal(getFeishuQrRedirect(event, instance, source, authorizationUrl), null);
  }
  assert.equal(getFeishuQrRedirect(validEvent, instance, null, authorizationUrl), null);
});

test("only the SDK-compatible authorization endpoint with state is accepted", () => {
  for (const url of [
    authorizationUrl.replace("https://passport.feishu.cn", "https://attacker.example"),
    authorizationUrl.replace("https://passport.feishu.cn", "https://passport.feishu.cn.attacker.example"),
    authorizationUrl.replace("https://", "http://"),
    authorizationUrl.replace("/suite/passport/oauth/authorize", "/open-apis/authen/v1/authorize"),
    authorizationUrl.replace("&state=one-time-state", ""),
    authorizationUrl.replace("https://", "https://user:password@")
  ]) {
    assert.throws(() => parseFeishuQrAuthorizationUrl(url));
  }
});
