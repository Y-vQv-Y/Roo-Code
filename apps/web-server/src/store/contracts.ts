import type { Checkpoint, Organization, Role, Session, Task, TaskEvent, User, UserGroup, Workspace } from "../domain.js"

export interface IdentityStore {
	getUserById(id: string): Promise<User | undefined>
	getUserByEmail(email: string): Promise<User | undefined>
	getUserByExternalSubject(providerId: string, subject: string): Promise<User | undefined>
	saveUser(user: User): Promise<void>
	getOrganization(id: string): Promise<Organization | undefined>
	saveOrganization(organization: Organization): Promise<void>
	listOrganizationsForUser(userId: string): Promise<Organization[]>
	listGroups(organizationId: string): Promise<UserGroup[]>
	saveGroup(group: UserGroup): Promise<void>
	listRoles(organizationId: string): Promise<Role[]>
	saveRole(role: Role): Promise<void>
	getSession(token: string): Promise<Session | undefined>
	saveSession(session: Session): Promise<void>
}

export interface WorkspaceStore {
	getWorkspace(id: string): Promise<Workspace | undefined>
	listWorkspacesForUser(userId: string): Promise<Workspace[]>
	saveWorkspace(workspace: Workspace): Promise<void>
}

export interface TaskStore {
	getTask(id: string): Promise<Task | undefined>
	saveTask(task: Task): Promise<void>
	appendTaskEvent(event: TaskEvent): Promise<void>
	listTaskEvents(taskId: string): Promise<TaskEvent[]>
}

export interface CheckpointStore {
	getCheckpoint(id: string): Promise<Checkpoint | undefined>
	saveCheckpoint(checkpoint: Checkpoint): Promise<void>
}
