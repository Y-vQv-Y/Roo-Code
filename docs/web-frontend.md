# ADTEC Code Web 前端对接

前端位于 `apps/web`，它是独立 Vite + React 应用，只依赖 `WebApi` 暴露的 REST/SSE 契约，不依赖 VS Code Webview API。

## 配置和启动

```text
VITE_ADTEC_API_URL=https://code.example.com
```

开发时运行 `pnpm --filter @adtec-code/web dev`，生产构建产物在 `apps/web/dist`。API 服务必须正确设置 `ADTEC_WEB_ORIGIN`，并在反向代理层启用 HTTPS。

## 登录

企业登录页应先调用 OIDC/OAuth2 start 接口，再把浏览器返回的 `code` 和 `state` 发送到 callback。LDAP 登录只在需要直接输入企业目录凭据的部署中显示。前端只保存短期 session token，退出时删除本地 token。

## 文件编辑和 Diff

文件内容由 `GET /v1/workspaces/{id}/files` 获取，保存使用 `PUT`，Patch 使用 `POST /patch`。响应中的 `diff` 每行带 `context`、`add` 或 `remove` 类型，渲染时必须保持红色删除、绿色新增，并显示文件路径。保存失败不得清空编辑器内容。

## 任务事件

不能使用原生 `EventSource`，因为它不能设置 Authorization header。`WebApi.subscribeTask` 使用 `fetch`、`ReadableStream` 和 `AbortController` 读取 SSE，并在页面卸载或任务结束时调用 `close()`。

## 多工作区和权限

前端只能显示服务端返回的工作区列表，不能让用户提交任意本地路径。组织、组、角色管理按钮应根据接口返回的 403 隐藏或禁用，但服务端权限校验始终是最终防线。
