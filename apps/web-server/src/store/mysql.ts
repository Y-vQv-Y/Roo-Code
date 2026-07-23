import type { Checkpoint, Organization, Role, Session, Task, TaskEvent, User, UserGroup, Workspace } from "../domain.js"
import type { CheckpointStore, IdentityStore, TaskStore, WorkspaceStore } from "./contracts.js"

export interface SqlClient {
	query<T extends Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<T[]>
}

function jsonArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
	if (typeof value !== "string") return []
	try {
		const parsed = JSON.parse(value) as unknown
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
	} catch {
		return []
	}
}

function jsonObject(value: unknown): Record<string, string> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, string>
	if (typeof value !== "string") return {}
	try {
		const parsed = JSON.parse(value) as unknown
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
	} catch {
		return {}
	}
}

function asIso(value: unknown): string {
	if (value instanceof Date) return value.toISOString()
	return String(value)
}

export class MySqlStore implements IdentityStore, WorkspaceStore, TaskStore, CheckpointStore {
	constructor(private readonly db: SqlClient) {}

	private user(row: Record<string, unknown>): User {
		return { id: String(row.id), email: String(row.email), displayName: String(row.display_name), organizationIds: jsonArray(row.organization_ids), groupIds: jsonArray(row.group_ids), roleIds: jsonArray(row.role_ids), identityProvider: row.identity_provider ? String(row.identity_provider) : undefined, externalSubject: row.external_subject ? String(row.external_subject) : undefined, createdAt: asIso(row.created_at) }
	}

	async getUserById(id: string): Promise<User | undefined> {
		const [row] = await this.db.query("SELECT * FROM users WHERE id = ?", [id])
		return row ? this.user(row) : undefined
	}

	async getUserByEmail(email: string): Promise<User | undefined> {
		const [row] = await this.db.query("SELECT * FROM users WHERE email = ?", [email])
		return row ? this.user(row) : undefined
	}

	async getUserByExternalSubject(providerId: string, subject: string): Promise<User | undefined> {
		const [row] = await this.db.query("SELECT * FROM users WHERE identity_provider = ? AND external_subject = ?", [providerId, subject])
		return row ? this.user(row) : undefined
	}

	async saveUser(user: User): Promise<void> {
		await this.db.query("INSERT INTO users (id, email, display_name, organization_ids, group_ids, role_ids, identity_provider, external_subject, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name), organization_ids = VALUES(organization_ids), group_ids = VALUES(group_ids), role_ids = VALUES(role_ids), identity_provider = VALUES(identity_provider), external_subject = VALUES(external_subject)", [user.id, user.email, user.displayName, JSON.stringify(user.organizationIds), JSON.stringify(user.groupIds), JSON.stringify(user.roleIds), user.identityProvider ?? null, user.externalSubject ?? null, user.createdAt])
	}

	async getOrganization(id: string): Promise<Organization | undefined> {
		const [row] = await this.db.query("SELECT * FROM organizations WHERE id = ?", [id])
		return row ? { id: String(row.id), name: String(row.name), createdAt: asIso(row.created_at) } : undefined
	}

	async saveOrganization(organization: Organization): Promise<void> {
		await this.db.query("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)", [organization.id, organization.name, organization.createdAt])
	}

	async listOrganizationsForUser(userId: string): Promise<Organization[]> {
		const user = await this.getUserById(userId)
		if (!user || user.organizationIds.length === 0) return []
		const placeholders = user.organizationIds.map(() => "?").join(", ")
		const rows = await this.db.query(`SELECT * FROM organizations WHERE id IN (${placeholders})`, user.organizationIds)
		return rows.map((row) => ({ id: String(row.id), name: String(row.name), createdAt: asIso(row.created_at) }))
	}

	async listGroups(organizationId: string): Promise<UserGroup[]> {
		const rows = await this.db.query("SELECT * FROM user_groups WHERE organization_id = ?", [organizationId])
		return rows.map((row) => ({ id: String(row.id), organizationId: String(row.organization_id), name: String(row.name), memberIds: jsonArray(row.member_ids), roleIds: jsonArray(row.role_ids) }))
	}

	async saveGroup(group: UserGroup): Promise<void> {
		await this.db.query("INSERT INTO user_groups (id, organization_id, name, member_ids, role_ids) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), member_ids = VALUES(member_ids), role_ids = VALUES(role_ids)", [group.id, group.organizationId, group.name, JSON.stringify(group.memberIds), JSON.stringify(group.roleIds)])
	}

	async listRoles(organizationId: string): Promise<Role[]> {
		const rows = await this.db.query("SELECT * FROM roles WHERE organization_id = ?", [organizationId])
		return rows.map((row) => ({ id: String(row.id), organizationId: String(row.organization_id), name: String(row.name), permissions: typeof row.permissions === "string" ? (JSON.parse(row.permissions) as Role["permissions"]) : (row.permissions as Role["permissions"]) }))
	}

	async saveRole(role: Role): Promise<void> {
		await this.db.query("INSERT INTO roles (id, organization_id, name, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), permissions = VALUES(permissions)", [role.id, role.organizationId, role.name, JSON.stringify(role.permissions)])
	}

	async getSession(token: string): Promise<Session | undefined> {
		const [row] = await this.db.query("SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP(3)", [token])
		return row ? { token: String(row.token), userId: String(row.user_id), expiresAt: new Date(String(row.expires_at)).getTime() } : undefined
	}

	async saveSession(session: Session): Promise<void> {
		await this.db.query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), expires_at = VALUES(expires_at)", [session.token, session.userId, new Date(session.expiresAt)])
	}

	async getWorkspace(id: string): Promise<Workspace | undefined> {
		const [row] = await this.db.query("SELECT * FROM workspaces WHERE id = ?", [id])
		return row ? { id: String(row.id), organizationId: String(row.organization_id), name: String(row.name), rootPath: String(row.root_path), createdBy: String(row.created_by), createdAt: asIso(row.created_at) } : undefined
	}

	async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
		const user = await this.getUserById(userId)
		if (!user || user.organizationIds.length === 0) return []
		const placeholders = user.organizationIds.map(() => "?").join(", ")
		const rows = await this.db.query(`SELECT * FROM workspaces WHERE organization_id IN (${placeholders})`, user.organizationIds)
		return rows.map((row) => ({ id: String(row.id), organizationId: String(row.organization_id), name: String(row.name), rootPath: String(row.root_path), createdBy: String(row.created_by), createdAt: asIso(row.created_at) }))
	}

	async saveWorkspace(workspace: Workspace): Promise<void> {
		await this.db.query("INSERT INTO workspaces (id, organization_id, name, root_path, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), root_path = VALUES(root_path)", [workspace.id, workspace.organizationId, workspace.name, workspace.rootPath, workspace.createdBy, workspace.createdAt])
	}

	async getTask(id: string): Promise<Task | undefined> {
		const [row] = await this.db.query("SELECT * FROM tasks WHERE id = ?", [id])
		return row ? { id: String(row.id), workspaceId: String(row.workspace_id), createdBy: String(row.created_by), prompt: String(row.prompt), status: row.status as Task["status"], createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at), agentIds: jsonArray(row.agent_ids) } : undefined
	}

	async saveTask(task: Task): Promise<void> {
		await this.db.query("INSERT INTO tasks (id, workspace_id, created_by, prompt, status, agent_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), agent_ids = VALUES(agent_ids), updated_at = VALUES(updated_at)", [task.id, task.workspaceId, task.createdBy, task.prompt, task.status, JSON.stringify(task.agentIds), task.createdAt, task.updatedAt])
	}

	async appendTaskEvent(event: TaskEvent): Promise<void> {
		await this.db.query("INSERT INTO task_events (id, task_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)", [event.id, event.taskId, event.type, JSON.stringify(event.data), event.createdAt])
	}

	async listTaskEvents(taskId: string): Promise<TaskEvent[]> {
		const rows = await this.db.query("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at, id", [taskId])
		return rows.map((row) => ({ id: String(row.id), taskId: String(row.task_id), type: row.type as TaskEvent["type"], data: jsonObject(row.data), createdAt: asIso(row.created_at) }))
	}

	async getCheckpoint(id: string): Promise<Checkpoint | undefined> {
		const [row] = await this.db.query("SELECT * FROM checkpoints WHERE id = ?", [id])
		return row ? { id: String(row.id), workspaceId: String(row.workspace_id), createdBy: String(row.created_by), createdAt: asIso(row.created_at), label: String(row.label), files: jsonObject(row.files) } : undefined
	}

	async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
		await this.db.query("INSERT INTO checkpoints (id, workspace_id, created_by, label, files, created_at) VALUES (?, ?, ?, ?, ?, ?)", [checkpoint.id, checkpoint.workspaceId, checkpoint.createdBy, checkpoint.label, JSON.stringify(checkpoint.files), checkpoint.createdAt])
	}
}
