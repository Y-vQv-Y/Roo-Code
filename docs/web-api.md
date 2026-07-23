# ADTEC Code Web API

基础地址由部署环境提供，例如 `https://code.example.com`。除 `/healthz` 和认证开始接口外，所有接口使用：

```http
Authorization: Bearer <session-token>
Content-Type: application/json
```

## 认证

### OIDC/OAuth2 开始

```http
POST /v1/auth/{providerId}/start
{
  "redirectUri": "https://code.example.com/auth/callback",
  "organizationId": "org_123"
}
```

返回 `state` 和 `authorizationUrl`。浏览器跳转到授权地址后，将回调中的 `state`、`code` 发送到：

```http
POST /v1/auth/callback
{ "state": "...", "code": "..." }
```

### LDAP

```http
POST /v1/auth/login
{
  "providerId": "corp-ldap",
  "organizationId": "org_123",
  "input": { "username": "alice", "password": "..." }
}
```

密码只在 TLS 连接中传输，服务端不保存 LDAP 密码。成功返回 `token`、`expiresAt` 和本地 `user`。

## 组织、组和权限

```http
GET  /v1/organizations
GET  /v1/organizations/{organizationId}
GET  /v1/organizations/{organizationId}/roles
GET  /v1/organizations/{organizationId}/groups
POST /v1/organizations/roles
POST /v1/organizations/groups
POST /v1/organizations/groups/{groupId}/members
```

角色权限结构：

```json
{
  "organizationId": "org_123",
  "workspaceId": "workspace_456",
  "resource": "file",
  "action": "write"
}
```

`workspaceId` 为空代表组织级权限；`resource` 支持 `workspace`、`file`、`task`、`settings`、`identity` 和 `*`；`action` 支持 `read`、`write`、`delete`、`execute`、`admin` 和 `*`。角色、组和用户必须属于同一组织，服务端会拒绝跨组织引用。

## 工作区和文件

```http
GET  /v1/workspaces
GET  /v1/workspaces/{workspaceId}/files?path=src/index.ts
PUT  /v1/workspaces/{workspaceId}/files
POST /v1/workspaces/{workspaceId}/patch
```

完整写入：

```json
{ "path": "src/index.ts", "content": "..." }
```

结构化 Patch：

```json
{
  "patch": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-old\n+new\n*** End Patch"
}
```

服务端拒绝绝对路径、`..` 穿越、符号链接逃逸和 `.adtec`/`.git` 受保护路径。成功响应包含红绿行级 `diff`，写入在全部 Patch hunk 校验通过后以临时文件原子替换。

## Checkpoint 和 Git

```http
POST /v1/workspaces/{workspaceId}/checkpoints
POST /v1/workspaces/{workspaceId}/checkpoints/{checkpointId}/restore
GET  /v1/workspaces/{workspaceId}/git/status
```

checkpoint 是文件快照，恢复会删除快照后新增文件并恢复原文件内容；Git `restore` 属于独立版本级操作，不会自动为每次写入创建 commit。

## 任务和 SSE

```http
POST /v1/tasks
GET  /v1/tasks/{taskId}/events
```

创建任务：

```json
{ "workspaceId": "workspace_456", "prompt": "检查并修复测试" }
```

事件流为标准 Server-Sent Events，事件类型为 `status`、`message`、`file_change`、`error`。浏览器客户端必须使用带 Bearer header 的 fetch 流式读取，不能把 session token 放入 URL。

## 错误

| 状态 | 含义 |
|---|---|
| 400 | 请求格式、路径或认证 state 无效 |
| 401 | 缺少或过期会话 |
| 403 | 权限不足 |
| 404 | 资源不存在或不属于当前组织 |
| 409 | Patch 上下文冲突 |
| 413 | 请求体超过 2 MiB |
| 500 | 服务端未预期错误 |
