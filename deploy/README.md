# 管理端生产部署

Jenkins 任务 `supply-chain-admin-prod` 从公开 GitHub 仓库 `hxy-0/supply-chain-admin` 的 main 分支读取 Jenkinsfile，每两分钟检查更新。
使用 Node 24、pnpm 12.9.1 构建，Nginx 提供静态文件和 API 代理，不启动 Vite 开发服务器。构建复用 Jenkins 主机已有的基础镜像；Docker Hub 镜像 DNS 恢复后应主动更新基础镜像，再恢复流水线 `--pull`。
前端构建只包含浏览器资源，禁止在 VITE_* 变量、源代码或镜像中存放公众号/小程序 AppSecret。

宿主机应用目录：`/opt/1panel/apps/supply-chain-admin/supply-chain-admin/`。
目录中的 docker-compose.yml 和 .env 由 Jenkins 发布同步，.env 只记录已部署的镜像 SHA 标签。
内网监听 `192.168.9.102:18082`，OpenResty 的 scm.hanxuyang.top 站点转发到此地址。
API 代理匹配 vite.config.ts：产品、微信、小程序等模块保留 /api 前缀，其余业务接口去掉 /api。

公开入口：https://scm.hanxuyang.top:8443/ 。
GitHub/飞书后台需登记 `/oauth/github/callback`、`/oauth/feishu/callback` 的完整 HTTPS 地址。
高德地图如需上线，使用生产 Web JS API 凭据配置构建环境的 VITE_AMAP_WEB_KEY、VITE_AMAP_SECURITY_JS_CODE；本地 .env.local 不会进入 Docker 构建。
部署沿用服务器 Jenkins 镜像、Docker CLI 和 Compose 插件；凭据和插件的基础配置见后端 deploy/README.md。

验收：Jenkins 成功、容器 healthy、主页返回 HTML、JS/CSS 200、API 返回后端 JSON、OAuth 回调路径返回前端页面。
单实例替换会短暂中断请求；完整业务登录和地图权限需要相应生产账号配置后验证。
