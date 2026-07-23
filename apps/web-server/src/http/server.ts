import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { URL } from "node:url"
import { z } from "zod"
import type { Task, TaskEvent, User, Workspace } from "../domain.js"
import { AuthFlowStore } from "../auth/flow-store.js"
import { AuthService } from "../auth/auth-service.js"
import { OidcIdentityProvider } from "../auth/providers.js"
import { WorkspaceCheckpointService } from "../files/checkpoints.js"
import { GitService } from "../git/git-service.js"
import { assertPermission } from "../security/rbac.js"
import type { IdentityStore, TaskStore, WorkspaceStore } from "../store/contracts.js"
import { AgentScheduler, TaskEventBus, TaskService } from "../tasks/task-service.js"
import { WorkspaceFileService } from "../files/workspace-files.js"
import { IdentityAdminService } from "../identity/identity-admin.js"
import { PatchFormatError } from "../files/patch.js"
import { WorkspacePathError } from "../security/path.js"
import { PermissionDeniedError } from "../security/rbac.js"

interface AppStores {
	identity: IdentityStore
	workspaces: WorkspaceStore
	tasks: TaskStore
}

export interface WebServerDependencies extends AppStores {
	auth: AuthService
	fileService(workspace: Workspace): WorkspaceFileService
	checkpointService: WorkspaceCheckpointService
	taskEvents: TaskEventBus
	taskService: TaskService
	identityAdmin: IdentityAdminService
	agentScheduler?: AgentScheduler
	agentExecutor?: (task: Task, workspace: Workspace, publish: (event: Omit<TaskEvent, "id" | "createdAt" | "taskId">) => Promise<void>) => Promise<void>
	flowStore?: AuthFlowStore
	git?: GitService
}

class ApiError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

const loginSchema = z.object({ providerId: z.string().min(1), organizationId: z.string().min(1), input: z.record(z.string()) })
const authStartSchema = z.object({ redirectUri: z.string().url(), organizationId: z.string().min(1) })
const authCallbackSchema = z.object({ state: z.string().min(1), code: z.string().min(1) })
const fileWriteSchema = z.object({ path: z.string().min(1), content: z.string() })
const patchSchema = z.object({ patch: z.string().min(1) })
const checkpointSchema = z.object({ label: z.string().min(1).max(120) })
const taskSchema = z.object({ workspaceId: z.string().min(1), prompt: z.string().min(1).max(100_000) })
const roleSchema = z.object({ organizationId: z.string().min(1), name: z.string().min(1).max(120), permissions: z.array(z.object({ organizationId: z.string().min(1), workspaceId: z.string().optional(), resource: z.enum(["workspace", "file", "task", "settings", "identity", "*"]), action: z.enum(["read", "write", "delete", "execute", "admin", "*"]) })) })
const groupSchema = z.object({ organizationId: z.string().min(1), name: z.string().min(1).max(120), roleIds: z.array(z.string()) })
const groupMemberSchema = z.object({ userId: z.string().min(1) })

function json(res: ServerResponse, status: number, payload: unknown): void {
	const body = JSON.stringify(payload)
	res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" })
	res.end(body)
}

function errorResponse(res: ServerResponse, error: unknown): void {
	if (error instanceof ApiError) return json(res, error.status, { error: error.message })
	if (error instanceof z.ZodError) return json(res, 400, { error: "Invalid request", issues: error.issues })
	if (error instanceof WorkspacePathError) return json(res, 400, { error: error.message })
	if (error instanceof PatchFormatError) return json(res, 409, { error: error.message })
	if (error instanceof PermissionDeniedError) return json(res, 403, { error: "Permission denied" })
	console.error(error)
	return json(res, 500, { error: "Unexpected server error" })
}

async function body(req: IncomingMessage): Promise<unknown> {
	let size = 0
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
		size += buffer.length
		if (size > 2 * 1024 * 1024) throw new ApiError(413, "Request body is too large")
		chunks.push(buffer)
	}
	if (chunks.length === 0) return {}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
	} catch {
		throw new ApiError(400, "Request body must be valid JSON")
	}
}

function bearer(req: IncomingMessage): string | undefined {
	const value = req.headers.authorization
	return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : undefined
}

async function currentUser(req: IncomingMessage, deps: WebServerDependencies): Promise<User> {
	const token = bearer(req)
	if (!token) throw new ApiError(401, "Bearer authentication is required")
	const user = await deps.auth.authenticateToken(token)
	if (!user) throw new ApiError(401, "Session is invalid or expired")
	return user
}

async function workspaceForUser(id: string, user: User, deps: WebServerDependencies, permission: { resource: "workspace" | "file" | "task"; action: "read" | "write" | "delete" | "admin" }): Promise<Workspace> {
	const workspace = await deps.workspaces.getWorkspace(id)
	if (!workspace || !user.organizationIds.includes(workspace.organizationId)) throw new ApiError(404, "Workspace not found")
	const roles = await deps.identity.listRoles(workspace.organizationId)
	const groups = await deps.identity.listGroups(workspace.organizationId)
	try {
		assertPermission(user, roles, groups, workspace.organizationId, workspace.id, permission.resource, permission.action)
	} catch {
		throw new ApiError(403, "Permission denied")
	}
	return workspace
}

function workspaceJson(workspace: Workspace): Record<string, unknown> {
	return { id: workspace.id, organizationId: workspace.organizationId, name: workspace.name, createdAt: workspace.createdAt }
}

function eventSse(event: TaskEvent): string {
	return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}

export function createWebServer(deps: WebServerDependencies) {
	const flows = deps.flowStore ?? new AuthFlowStore()
	const git = deps.git ?? new GitService()
	return createServer(async (req, res) => {
		res.setHeader("access-control-allow-origin", process.env.ADTEC_WEB_ORIGIN ?? "*")
		res.setHeader("access-control-allow-headers", "authorization, content-type")
		res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS")
		if (req.method === "OPTIONS") return res.writeHead(204).end()
		try {
			const requestUrl = new URL(req.url ?? "/", "http://localhost")
			const pathname = requestUrl.pathname
			if (req.method === "GET" && pathname === "/healthz") return json(res, 200, { status: "ok" })

			const startMatch = pathname.match(/^\/v1\/auth\/([^/]+)\/start$/)
			if (req.method === "POST" && startMatch) {
				const input = authStartSchema.parse(await body(req))
				const provider = deps.auth.getProvider(startMatch[1])
				if (!(provider instanceof OidcIdentityProvider) || typeof provider.createAuthorizationRequest !== "function") throw new ApiError(404, "OIDC provider not found")
				const flow = flows.create({ providerId: provider.id, verifier: "pending", redirectUri: input.redirectUri, organizationId: input.organizationId })
				const authorization = await provider.createAuthorizationRequest(input.redirectUri, flow.state)
				flows.setVerifier(flow.state, authorization.verifier)
				return json(res, 200, { state: flow.state, authorizationUrl: authorization.url })
			}

			if (req.method === "POST" && pathname === "/v1/auth/login") {
				const input = loginSchema.parse(await body(req))
				const provider = deps.auth.getProvider(input.providerId)
				if (!provider || provider.kind !== "ldap") throw new ApiError(400, "OAuth2/OIDC login must use the authorization-code flow")
				const result = await deps.auth.authenticate(input.providerId, input.input, input.organizationId)
				return json(res, 200, { user: result.user, token: result.session.token, expiresAt: result.session.expiresAt })
			}

			if (req.method === "POST" && pathname === "/v1/auth/callback") {
				const input = authCallbackSchema.parse(await body(req))
				const flow = flows.consume(input.state)
				if (!flow) throw new ApiError(400, "Authentication state is invalid or expired")
				const result = await deps.auth.authenticate(flow.providerId, { code: input.code, verifier: flow.verifier, redirectUri: flow.redirectUri }, flow.organizationId)
				return json(res, 200, { user: result.user, token: result.session.token, expiresAt: result.session.expiresAt })
			}

			const user = await currentUser(req, deps)
			if (req.method === "GET" && pathname === "/v1/me") return json(res, 200, { user })
			if (req.method === "GET" && pathname === "/v1/workspaces") {
				const workspaces = await deps.workspaces.listWorkspacesForUser(user.id)
				const visible = []
				for (const workspace of workspaces) {
					try {
						visible.push(await workspaceForUser(workspace.id, user, deps, { resource: "workspace", action: "read" }))
					} catch {
						// Hide workspaces the user cannot read.
					}
				}
				return json(res, 200, { workspaces: visible.map(workspaceJson) })
			}

			const organizationsMatch = pathname.match(/^\/v1\/organizations\/([^/]+)(?:\/(groups|roles))?$/)
			if (organizationsMatch && req.method === "GET") {
				const organizationId = organizationsMatch[1]
				if (!user.organizationIds.includes(organizationId)) throw new ApiError(404, "Organization not found")
				if (organizationsMatch[2] === "groups") return json(res, 200, { groups: await deps.identity.listGroups(organizationId) })
				if (organizationsMatch[2] === "roles") return json(res, 200, { roles: await deps.identity.listRoles(organizationId) })
				return json(res, 200, { organization: await deps.identity.getOrganization(organizationId) })
			}
			if (req.method === "GET" && pathname === "/v1/organizations") return json(res, 200, { organizations: await deps.identity.listOrganizationsForUser(user.id) })

			if (req.method === "POST" && pathname === "/v1/organizations/roles") {
				const input = roleSchema.parse(await body(req))
				const organization = await deps.identity.getOrganization(input.organizationId)
				if (!organization || !user.organizationIds.includes(organization.id)) throw new ApiError(404, "Organization not found")
				return json(res, 201, { role: await deps.identityAdmin.createRole(user, input.organizationId, input.name, input.permissions) })
			}
			if (req.method === "POST" && pathname === "/v1/organizations/groups") {
				const input = groupSchema.parse(await body(req))
				const organization = await deps.identity.getOrganization(input.organizationId)
				if (!organization || !user.organizationIds.includes(organization.id)) throw new ApiError(404, "Organization not found")
				return json(res, 201, { group: await deps.identityAdmin.createGroup(user, input.organizationId, input.name, input.roleIds) })
			}
			const groupMemberMatch = pathname.match(/^\/v1\/organizations\/groups\/([^/]+)\/members$/)
			if (req.method === "POST" && groupMemberMatch) {
				const input = groupMemberSchema.parse(await body(req))
				return json(res, 200, { group: await deps.identityAdmin.addGroupMember(user, groupMemberMatch[1], input.userId) })
			}

			const workspaceFileMatch = pathname.match(/^\/v1\/workspaces\/([^/]+)\/files$/)
			if (workspaceFileMatch && req.method === "GET") {
				const workspace = await workspaceForUser(workspaceFileMatch[1], user, deps, { resource: "file", action: "read" })
				const filePath = requestUrl.searchParams.get("path")
				if (!filePath) throw new ApiError(400, "path query parameter is required")
				return json(res, 200, { path: filePath, content: await deps.fileService(workspace).read(filePath) })
			}
			if (workspaceFileMatch && req.method === "PUT") {
				const workspace = await workspaceForUser(workspaceFileMatch[1], user, deps, { resource: "file", action: "write" })
				const input = fileWriteSchema.parse(await body(req))
				return json(res, 200, { change: await deps.fileService(workspace).write(input.path, input.content) })
			}

			const patchMatch = pathname.match(/^\/v1\/workspaces\/([^/]+)\/patch$/)
			if (patchMatch && req.method === "POST") {
				const workspace = await workspaceForUser(patchMatch[1], user, deps, { resource: "file", action: "write" })
				const input = patchSchema.parse(await body(req))
				return json(res, 200, { changes: await deps.fileService(workspace).applyPatch(input.patch) })
			}

			const checkpointMatch = pathname.match(/^\/v1\/workspaces\/([^/]+)\/checkpoints(?:\/([^/]+)\/restore)?$/)
			if (checkpointMatch && req.method === "POST") {
				const workspace = await workspaceForUser(checkpointMatch[1], user, deps, { resource: "file", action: "write" })
				if (checkpointMatch[2]) return json(res, 200, { changes: await deps.checkpointService.restore(workspace, checkpointMatch[2]) })
				const input = checkpointSchema.parse(await body(req))
				return json(res, 201, { checkpoint: await deps.checkpointService.create(workspace, user.id, input.label) })
			}

			const gitMatch = pathname.match(/^\/v1\/workspaces\/([^/]+)\/git\/status$/)
			if (gitMatch && req.method === "GET") {
				const workspace = await workspaceForUser(gitMatch[1], user, deps, { resource: "workspace", action: "read" })
				return json(res, 200, await git.status(workspace.rootPath))
			}

			if (req.method === "POST" && pathname === "/v1/tasks") {
				const input = taskSchema.parse(await body(req))
				const workspace = await workspaceForUser(input.workspaceId, user, deps, { resource: "task", action: "write" })
				const task = await deps.taskService.create(workspace, user.id, input.prompt)
				if (deps.agentScheduler && deps.agentExecutor) void deps.agentScheduler.run(task, workspace, (context, publish) => deps.agentExecutor!(context.task, context.workspace, publish)).catch(() => undefined)
				return json(res, 202, { task })
			}

			const taskEventsMatch = pathname.match(/^\/v1\/tasks\/([^/]+)\/events$/)
			if (req.method === "GET" && taskEventsMatch) {
				const task = await deps.taskService.get(taskEventsMatch[1])
				if (!task) throw new ApiError(404, "Task not found")
				await workspaceForUser(task.workspaceId, user, deps, { resource: "task", action: "read" })
				res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" })
				for (const event of await deps.taskService.eventsFor(task.id)) res.write(eventSse(event))
				const unsubscribe = deps.taskEvents.subscribe(task.id, (event) => res.write(eventSse(event)))
				const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15_000)
				req.on("close", () => {
					clearInterval(heartbeat)
					unsubscribe()
				})
				return
			}

			throw new ApiError(404, "Route not found")
		} catch (error) {
			errorResponse(res, error)
		}
	})
}
