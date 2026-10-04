import Cookies from "js-cookie";
import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal, isString, isIncludeAllChildren } from "@pureadmin/utils";

export interface DataInfo<T> {
  /** token */
  accessToken: string;
  /** `accessToken`的过期时间（时间戳） */
  expires: T;
  /** 用于调用刷新accessToken的接口时所需的token */
  refreshToken: string;
  /** refresh token 到期时间，毫秒时间戳 */
  refreshExpires: number;
  /** 头像 */
  avatar?: string;
  /** 用户名 */
  username?: string;
  /** 昵称 */
  nickname?: string;
  /** 当前登录用户的角色 */
  roles?: Array<string>;
  /** 当前登录用户的按钮级别权限 */
  permissions?: Array<string>;
}

export const userKey = "user-info";
/** 历史版本曾把令牌整包写入 cookie；现令牌统一保存在 localStorage，残留的 2KB 令牌 cookie 在写入与登出时清理。 */
export const TokenKey = "authorized-token";
/** 历史版本的会话标记 cookie；登录态现已只由 localStorage 里的`refreshExpires`判定，残留 cookie 在写入与登出时清理。 */
export const multipleTabsKey = "multiple-tabs";

/** 获取`token`，令牌统一保存在 localStorage 的`user-info`里 */
export function getToken(): DataInfo<number> {
  return storageLocal().getItem<DataInfo<number>>(userKey);
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`）、`expires`（`accessToken`的过期时间）、`refreshExpires`（`refreshToken`的过期时间）。
 * 「N 天内免登录」由登录时传给后端的`rememberDays`决定 refresh token 的有效期（refresh 会话保存在后端 Redis 里）；
 * 登录态只由 localStorage 中`refreshExpires`是否过期判定，不依赖任何 cookie。
 */
export function setToken(data: DataInfo<number>) {
  const { accessToken, refreshToken, refreshExpires } = data;
  const expires = new Date(data.expires).getTime(); // 毫秒时间戳，兼容升级前的 ISO 字符串。
  // 清理历史版本写入的令牌与会话标记 cookie。
  Cookies.remove(TokenKey);
  Cookies.remove(multipleTabsKey);

  function setUserKey({ avatar, username, nickname, roles, permissions }) {
    useUserStoreHook().SET_AVATAR(avatar);
    useUserStoreHook().SET_USERNAME(username);
    useUserStoreHook().SET_NICKNAME(nickname);
    useUserStoreHook().SET_ROLES(roles);
    useUserStoreHook().SET_PERMS(permissions);
    storageLocal().setItem(userKey, {
      accessToken,
      refreshToken,
      refreshExpires,
      expires,
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }

  if (data.username && data.roles) {
    const { username, roles } = data;
    setUserKey({
      avatar: data?.avatar ?? "",
      username,
      nickname: data?.nickname ?? "",
      roles,
      permissions: data?.permissions ?? []
    });
  } else {
    const avatar =
      storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "";
    const username =
      storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "";
    const nickname =
      storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "";
    const roles =
      storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [];
    const permissions =
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [];
    setUserKey({
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }
}

/** 删除`token`以及key值为`user-info`的localStorage信息 */
export function removeToken() {
  Cookies.remove(TokenKey);
  Cookies.remove(multipleTabsKey);
  storageLocal().removeItem(userKey);
}

/** 格式化token（jwt格式） */
export const formatToken = (token: string): string => {
  return "Bearer " + token;
};

/** 是否有按钮级别的权限（根据登录接口返回的`permissions`字段进行判断）*/
export const hasPerms = (value: string | Array<string>): boolean => {
  if (!value) return false;
  const allPerms = "*:*:*";
  const { permissions } = useUserStoreHook();
  if (!permissions) return false;
  if (permissions.length === 1 && permissions[0] === allPerms) return true;
  const isAuths = isString(value)
    ? permissions.includes(value)
    : isIncludeAllChildren(value, permissions);
  return isAuths ? true : false;
};
