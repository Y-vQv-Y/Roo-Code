# ADTEC Code Web Server

`apps/web-server` 是独立于 VS Code Webview 和 CLI ExtensionHost 的 HTTP 服务层。它不读取 VS Code IPC，也不把浏览器请求直接转发到 `ClineProvider`。

## 运行边界

- Node.js 20.19.2+
- MySQL 8.0.36+ 或 8.4 LTS：保存组织、用户、用户组、角色、权限、工作区、任务和 checkpoint
- Redis：跨服务实例广播任务 SSE 事件，不作为权限数据源
- 工作区根目录必须由服务端配置，客户端不能提交新的根目录

## 配置

```text
ADTEC_WORKSPACE_ROOT=/srv/adtec/workspace
PORT=8787
ADTEC_WEB_ORIGIN=https://code.example.com
ADTEC_BOOTSTRAP_TOKEN=仅用于首次部署的短期令牌
```

生产装配应将 MySQL 连接池包装成 `SqlClient`，将 Redis 客户端包装成 `RedisPublisher`/`RedisSubscriber`，再传给 `createWebServer`。这样数据库和缓存客户端可以由部署平台统一管理，服务核心不会绑定某个驱动实例。

执行 `migrations/001_initial.sql` 后，再创建组织、管理员角色和工作区。不要把 `ADTEC_BOOTSTRAP_TOKEN` 长期保留在生产环境。

## 身份认证

- OAuth2：`OAuth2IdentityProvider` 使用授权码 + PKCE。
- OIDC：`OidcIdentityProvider` 从 issuer discovery 文档获取授权、token、userinfo 端点。
- LDAP：`LdapIdentityProvider` 要求先查询用户 DN，再使用用户密码 bind；连接器由企业 LDAP 客户端注入。
- 外部组只会精确映射到本地预先创建的同名用户组，不会因为 IdP 返回任意组名自动授予权限。

HTTP 直接登录只对 LDAP 开放。OAuth2/OIDC 必须经过 `/v1/auth/:providerId/start` 和 `/v1/auth/callback`，state 一次消费且 PKCE verifier 只保存在服务端。

## 本地开发

服务启动前必须设置 `ADTEC_WORKSPACE_ROOT`。开发测试可以设置 `ADTEC_BOOTSTRAP_TOKEN`，然后将该值作为 `Authorization: Bearer` 令牌调用 API。生产环境应关闭 bootstrap 会话并只使用企业身份提供商。
