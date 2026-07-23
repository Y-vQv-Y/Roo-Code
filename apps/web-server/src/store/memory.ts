import type { Checkpoint, Organization, Role, Session, Task, TaskEvent, User, UserGroup, Workspace } from "../domain.js"
import type { CheckpointStore, IdentityStore, TaskStore, WorkspaceStore } from "./contracts.js"

export class MemoryStore implements IdentityStore, WorkspaceStore, TaskStore, CheckpointStore {
	private readonly users = new Map<string, User>()
	private readonly organizations = new Map<string, Organization>()
	private readonly groups = new Map<string, UserGroup>()
	private readonly roles = new Map<string, Role>()
	private readonly sessions = new Map<string, Session>()
	private readonly workspaces = new Map<string, Workspace>()
	private readonly tasks = new Map<string, Task>()
	private readonly taskEvents = new Map<string, TaskEvent[]>()
	private readonly checkpoints = new Map<string, Checkpoint>()

	async getUserById(id: string): Promise<User | undefined> {
		return this.users.get(id)
	}

	async getUserByEmail(email: string): Promise<User | undefined> {
		return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase())
	}

	async getUserByExternalSubject(providerId: string, subject: string): Promise<User | undefined> {
		return [...this.users.values()].find((user) => user.identityProvider === providerId && user.externalSubject === subject)
	}

	async saveUser(user: User): Promise<void> {
		this.users.set(user.id, user)
	}

	async getOrganization(id: string): Promise<Organization | undefined> {
		return this.organizations.get(id)
	}

	async saveOrganization(organization: Organization): Promise<void> {
		this.organizations.set(organization.id, organization)
	}

	async listOrganizationsForUser(userId: string): Promise<Organization[]> {
		const user = this.users.get(userId)
		return user ? user.organizationIds.map((id) => this.organizations.get(id)).filter((item): item is Organization => item !== undefined) : []
	}

	async listGroups(organizationId: string): Promise<UserGroup[]> {
		return [...this.groups.values()].filter((group) => group.organizationId === organizationId)
	}

	async saveGroup(group: UserGroup): Promise<void> {
		this.groups.set(group.id, group)
	}

	async listRoles(organizationId: string): Promise<Role[]> {
		return [...this.roles.values()].filter((role) => role.organizationId === organizationId)
	}

	async saveRole(role: Role): Promise<void> {
		this.roles.set(role.id, role)
	}

	async getSession(token: string): Promise<Session | undefined> {
		const session = this.sessions.get(token)
		if (session && session.expiresAt <= Date.now()) {
			this.sessions.delete(token)
			return undefined
		}
		return session
	}

	async saveSession(session: Session): Promise<void> {
		this.sessions.set(session.token, session)
	}

	async getWorkspace(id: string): Promise<Workspace | undefined> {
		return this.workspaces.get(id)
	}

	async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
		const user = this.users.get(userId)
		if (!user) return []
		const organizationIds = new Set(user.organizationIds)
		return [...this.workspaces.values()].filter((workspace) => organizationIds.has(workspace.organizationId))
	}

	async saveWorkspace(workspace: Workspace): Promise<void> {
		this.workspaces.set(workspace.id, workspace)
	}

	async getTask(id: string): Promise<Task | undefined> {
		return this.tasks.get(id)
	}

	async saveTask(task: Task): Promise<void> {
		this.tasks.set(task.id, task)
	}

	async appendTaskEvent(event: TaskEvent): Promise<void> {
		const events = this.taskEvents.get(event.taskId) ?? []
		events.push(event)
		this.taskEvents.set(event.taskId, events)
	}

	async listTaskEvents(taskId: string): Promise<TaskEvent[]> {
		return [...(this.taskEvents.get(taskId) ?? [])]
	}

	async getCheckpoint(id: string): Promise<Checkpoint | undefined> {
		return this.checkpoints.get(id)
	}

	async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
		this.checkpoints.set(checkpoint.id, checkpoint)
	}

	seed(input: { organizations?: Organization[]; users?: User[]; groups?: UserGroup[]; roles?: Role[]; workspaces?: Workspace[] }): void {
		for (const organization of input.organizations ?? []) this.organizations.set(organization.id, organization)
		for (const user of input.users ?? []) this.users.set(user.id, user)
		for (const group of input.groups ?? []) this.groups.set(group.id, group)
		for (const role of input.roles ?? []) this.roles.set(role.id, role)
		for (const workspace of input.workspaces ?? []) this.workspaces.set(workspace.id, workspace)
	}
}
