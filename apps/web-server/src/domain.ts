export type Id = string

export type PermissionAction = "read" | "write" | "delete" | "execute" | "admin"
export type PermissionResource = "workspace" | "file" | "task" | "settings" | "identity"

export interface Permission {
	organizationId: Id
	workspaceId?: Id
	resource: PermissionResource | "*"
	action: PermissionAction | "*"
}

export interface Organization {
	id: Id
	name: string
	createdAt: string
}

export interface User {
	id: Id
	email: string
	displayName: string
	organizationIds: Id[]
	groupIds: Id[]
	roleIds: Id[]
	identityProvider?: string
	externalSubject?: string
	createdAt: string
}

export interface UserGroup {
	id: Id
	organizationId: Id
	name: string
	memberIds: Id[]
	roleIds: Id[]
}

export interface Role {
	id: Id
	organizationId: Id
	name: string
	permissions: Permission[]
}

export interface Workspace {
	id: Id
	organizationId: Id
	name: string
	rootPath: string
	createdBy: Id
	createdAt: string
}

export interface Session {
	token: string
	userId: Id
	expiresAt: number
}

export type FileOperation = "read" | "write" | "delete" | "patch"

export interface FileDiffEntry {
	type: "context" | "add" | "remove"
	line: number
	text: string
}

export interface FileChange {
	path: string
	operation: FileOperation
	diff: FileDiffEntry[]
}

export interface Checkpoint {
	id: Id
	workspaceId: Id
	createdBy: Id
	createdAt: string
	label: string
	files: Record<string, string>
}

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export interface Task {
	id: Id
	workspaceId: Id
	createdBy: Id
	prompt: string
	status: TaskStatus
	createdAt: string
	updatedAt: string
	agentIds: Id[]
}

export interface TaskEvent {
	id: Id
	taskId: Id
	type: "status" | "message" | "file_change" | "error"
	data: Record<string, unknown>
	createdAt: string
}

export interface IdentityProfile {
	subject: string
	email: string
	displayName: string
	groups?: string[]
}

export interface IdentityProvider {
	readonly kind: "oauth2" | "oidc" | "ldap"
	readonly id: string
	authenticate(input: Record<string, string>): Promise<IdentityProfile>
}

export interface AgentRunContext {
	task: Task
	workspace: Workspace
	worktreePath?: string
}

export type AgentExecutor = (context: AgentRunContext, publish: (event: Omit<TaskEvent, "id" | "createdAt" | "taskId">) => Promise<void>) => Promise<void>
