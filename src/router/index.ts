import { getConfig } from "@/config";
import NProgress from "@/utils/progress";
import { transformI18n } from "@/plugins/i18n";
import { buildHierarchyTree } from "@/utils/tree";
import remainingRouter from "./modules/remaining";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { isUrl, openLink, cloneDeep, storageLocal } from "@pureadmin/utils";
import {
  ascending,
  initRouter,
  isOneOfArray,
  getHistoryMode,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes
} from "./utils";
import {
  type Router,
  type RouteRecordRaw,
  type RouteComponent,
  createRouter
} from "vue-router";
import { type DataInfo, userKey, removeToken } from "@/utils/auth";
import {
  isRestorablePath,
  loginDestination,
  lastPageKey
} from "./sessionRoute";
import { message } from "@/utils/message";

/** 自动导入全部静态路由，无需再手动引入！匹配 src/router/modules 目录（任何嵌套级别）中具有 .ts 扩展名的所有文件，除了 remaining.ts 文件
 * 如何匹配所有文件请看：https://github.com/mrmlnc/fast-glob#basic-syntax
 * 如何排除文件请看：https://cn.vitejs.dev/guide/features.html#negative-patterns
 */
const modules: Record<string, any> = import.meta.glob(["./modules/home.ts"], {
  eager: true
});

/** 原始静态路由（未做任何处理） */
const routes = [];

Object.keys(modules).forEach(key => {
  routes.push(modules[key].default);
});

/** 导出处理后的静态路由（三级及以上的路由全部拍成二级） */
export const constantRoutes: Array<RouteRecordRaw> = formatTwoStageRoutes(
  formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
);

/** 初始的静态路由，用于退出登录时重置路由 */
const initConstantRoutes: Array<RouteRecordRaw> = cloneDeep(constantRoutes);

/** 用于渲染菜单，保持原始层级 */
export const constantMenus: Array<RouteComponent> = ascending(
  routes.flat(Infinity)
).concat(...remainingRouter);

/** 不参与菜单的路由 */
export const remainingPaths = Object.keys(remainingRouter).map(v => {
  return remainingRouter[v].path;
});

/** 创建路由实例 */
export const router: Router = createRouter({
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY),
  routes: constantRoutes.concat(...(remainingRouter as any)),
  strict: true,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(resolve => {
      if (savedPosition) {
        return savedPosition;
      } else {
        if (from.meta.saveSrollTop) {
          const top: number =
            document.documentElement.scrollTop || document.body.scrollTop;
          resolve({ left: 0, top });
        }
      }
    });
  }
});

/** 记录已经加载的页面路径 */
const loadedPaths = new Set<string>();

/** 重置已加载页面记录 */
export function resetLoadedPaths() {
  loadedPaths.clear();
}

/** 重置路由 */
export function resetRouter() {
  router.clearRoutes();
  for (const route of initConstantRoutes.concat(...(remainingRouter as any))) {
    router.addRoute(route);
  }
  router.options.routes = formatTwoStageRoutes(
    formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
  );
  usePermissionStoreHook().clearAllCachePage();
  resetLoadedPaths();
}

/** 路由白名单 */
const whiteList = ["/login", "/oauth/callback"];

const { VITE_HIDE_HOME } = import.meta.env;

router.beforeEach(async (to: ToRouteType, _from) => {
  to.meta.loaded = loadedPaths.has(to.path);

  if (!to.meta.loaded) {
    NProgress.start();
  }

  if (to.meta?.keepAlive) {
    handleAliveRoute(to, "add");
    // 页面整体刷新和点击标签页刷新
    if (_from.name === undefined || _from.name === "Redirect") {
      handleAliveRoute(to);
    }
  }
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  // 登录态只由 refresh token 是否过期判定：过期即视为未登录，重新登录；
  // access token 的无感续期由 http 层在请求前用 refresh token 完成。
  const sessionValid =
    !!userInfo && Number(userInfo.refreshExpires) > Date.now();
  const externalLink = isUrl(to?.name as string);
  if (!externalLink) {
    to.matched.some(item => {
      if (!item.meta.title) return "";
      const Title = getConfig().Title;
      if (Title)
        document.title = `${transformI18n(item.meta.title)} | ${Title}`;
      else document.title = transformI18n(item.meta.title);
    });
  }
  /** 如果已经登录并存在登录信息后不能跳转到路由白名单，而是继续保持在当前页面 */
  function toCorrectRoute() {
    if (to.path !== "/login") return undefined;
    return loginDestination(
      to.query.redirect,
      storageLocal().getItem(lastPageKey(userInfo?.username || ""))
    );
  }
  if (sessionValid) {
    if (
      usePermissionStoreHook().wholeMenus.length === 0 &&
      to.path !== "/oauth/callback"
    ) {
      try {
        await initRouter();
      } catch {
        message("菜单加载失败，请稍后刷新重试", { type: "error" });
        NProgress.done();
        return false;
      }
      if (!to.name && router.resolve(to.fullPath).name) return to.fullPath;
    }
    if (to.path === "/welcome" && to.redirectedFrom?.path === "/") {
      const lastPage = storageLocal().getItem<string>(
        lastPageKey(userInfo.username || "")
      );
      if (
        isRestorablePath(lastPage) &&
        lastPage !== "/welcome" &&
        router.resolve(lastPage).name &&
        router.resolve(lastPage).name !== "PageNotFound"
      ) {
        return lastPage;
      }
    }
    // 无权限跳转403页面
    if (to.meta?.roles && !isOneOfArray(to.meta?.roles, userInfo?.roles)) {
      return { path: "/error/403" };
    }
    // 开启隐藏首页后在浏览器地址栏手动输入首页welcome路由则跳转到404页面
    if (VITE_HIDE_HOME === "true" && to.fullPath === "/welcome") {
      return { path: "/error/404" };
    }
    if (_from?.name) {
      // name为超链接
      if (externalLink) {
        openLink(to?.name as string);
        NProgress.done();
        return false;
      } else {
        return toCorrectRoute();
      }
    } else {
      return toCorrectRoute();
    }
  } else {
    if (to.path !== "/login") {
      if (whiteList.indexOf(to.path) !== -1) {
        return true;
      } else {
        removeToken();
        return {
          path: "/login",
          query:
            to.redirectedFrom?.path === "/" ? {} : { redirect: to.fullPath }
        };
      }
    } else {
      return true;
    }
  }
});

router.afterEach((to, _from, failure) => {
  if (failure) {
    NProgress.done();
    return;
  }
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  if (
    userInfo?.username &&
    isRestorablePath(to.fullPath) &&
    to.name !== "PageNotFound"
  ) {
    storageLocal().setItem(lastPageKey(userInfo.username), to.fullPath);
  }
  loadedPaths.add(to.path);
  NProgress.done();
});

export default router;

// 路由模块热更新会创建新实例，但已挂载的应用仍注入旧实例。
// 开发时重新加载应用，确保导航代码与 RouterView 使用同一个路由实例。
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
