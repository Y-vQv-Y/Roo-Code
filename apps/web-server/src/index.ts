import { pathToFileURL } from "node:url"
import process from "node:process"
import type { IdentityProvider, Organization, Role, User, Workspace } from "./domain.js"
import { AuthService } from "./auth/auth-service.js"
import { AuthFlowStore } from "./auth/flow-store.js"
import { WorkspaceCheckpointService } from "./files/checkpoints.js"
import { WorkspaceFileService } from "./files/workspace-files.js"
import { createWebServer, type WebServerDependencies } from "./http/server.js"
import { MemoryStore } from "./store/memory.js"
import { IdentityAdminService } from "./identity/identity-admin.js"
import { AgentScheduler, TaskEventBus, TaskService } from "./tasks/task-service.js"

export interface InMemoryApp {
	server: ReturnType<typeof createWebServer>
	stores: MemoryStore
	bootstrapToken?: string
	workspace: Workspace
}

export function createInMemoryApp(rootPath: string, providers: readonly IdentityProvider[] = []): InMemoryApp {
	const store = new MemoryStore()
	const organization: Organization = { id: "org-demo", name: "ADTEC Demo", createdAt: new Date().toISOString() }
	const role: Role = { id: "role-admin", organizationId: organization.id, name: "Administrator", permissions: [{ organizationId: organization.id, resource: "*", action: "*" }] }
	const user: User = { id: "user-demo", email: "admin@example.com", displayName: "ADTEC Administrator", organizationIds: [organization.id], groupIds: [], roleIds: [role.id], createdAt: new Date().toISOString() }
	const workspace: Workspace = { id: "workspace-demo", organizationId: organization.id, name: "Demo workspace", rootPath, createdBy: user.id, createdAt: new Date().toISOString() }
	store.seed({ organizations: [organization], users: [user], roles: [role], workspaces: [workspace] })
	const bootstrapToken = process.env.ADTEC_BOOTSTRAP_TOKEN
	if (bootstrapToken) void store.saveSession({ token: bootstrapToken, userId: user.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
	const taskEvents = new TaskEventBus(store)
	const taskService = new TaskService(store, taskEvents)
	const dependencies: WebServerDependencies = {
		identity: store,
		workspaces: store,
		tasks: store,
		auth: new AuthService(store, providers),
		fileService: (item) => new WorkspaceFileService(item.rootPath, [".git", ".adtec"]),
		checkpointService: new WorkspaceCheckpointService(store),
		taskEvents,
		taskService,
		identityAdmin: new IdentityAdminService(store),
		agentScheduler: new AgentScheduler(taskService, taskEvents),
		flowStore: new AuthFlowStore(),
	}
	return { server: createWebServer(dependencies), stores: store, bootstrapToken, workspace }
}

export function startFromEnvironment(): void {
	const rootPath = process.env.ADTEC_WORKSPACE_ROOT
	if (!rootPath) throw new Error("ADTEC_WORKSPACE_ROOT must be set before starting the web server")
	const app = createInMemoryApp(rootPath)
	const port = Number(process.env.PORT ?? 8787)
	app.server.listen(port, "0.0.0.0", () => {
		console.log(`ADTEC web server listening on ${port}`)
		if (app.bootstrapToken) console.log("Bootstrap session enabled")
	})
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startFromEnvironment()

export * from "./auth/auth-service.js"
export * from "./auth/providers.js"
export * from "./domain.js"
export * from "./files/checkpoints.js"
export * from "./files/diff.js"
export * from "./files/patch.js"
export * from "./files/workspace-files.js"
export * from "./git/git-service.js"
export * from "./http/server.js"
export * from "./identity/identity-admin.js"
export * from "./security/path.js"
export * from "./security/rbac.js"
export * from "./store/memory.js"
export * from "./store/mysql.js"
export * from "./store/redis.js"
export * from "./tasks/task-service.js"
