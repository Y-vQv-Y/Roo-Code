import { randomUUID } from "node:crypto"
import type { Permission, Role, User, UserGroup } from "../domain.js"
import type { IdentityStore } from "../store/contracts.js"
import { assertPermission } from "../security/rbac.js"

export class IdentityAdminService {
	constructor(private readonly store: IdentityStore) {}

	private async assertAdmin(actor: User, organizationId: string): Promise<void> {
		const roles = await this.store.listRoles(organizationId)
		const groups = await this.store.listGroups(organizationId)
		assertPermission(actor, roles, groups, organizationId, undefined, "identity", "admin")
	}

	async createRole(actor: User, organizationId: string, name: string, permissions: readonly Permission[]): Promise<Role> {
		await this.assertAdmin(actor, organizationId)
		if (permissions.some((permission) => permission.organizationId !== organizationId)) throw new Error("Role permissions must belong to the same organization")
		const role: Role = { id: randomUUID(), organizationId, name, permissions: [...permissions] }
		await this.store.saveRole(role)
		return role
	}

	async createGroup(actor: User, organizationId: string, name: string, roleIds: readonly string[]): Promise<UserGroup> {
		await this.assertAdmin(actor, organizationId)
		const roles = await this.store.listRoles(organizationId)
		if (roleIds.some((roleId) => !roles.some((role) => role.id === roleId))) throw new Error("Group references a role from another organization")
		const group: UserGroup = { id: randomUUID(), organizationId, name, memberIds: [], roleIds: [...roleIds] }
		await this.store.saveGroup(group)
		return group
	}

	async addGroupMember(actor: User, groupId: string, userId: string): Promise<UserGroup> {
		const groupLists = await Promise.all(actor.organizationIds.map((organizationId) => this.store.listGroups(organizationId)))
		const groups = groupLists.flat()
		const group = groups.find((item) => item.id === groupId)
		if (!group) throw new Error("Group not found")
		await this.assertAdmin(actor, group.organizationId)
		const member = await this.store.getUserById(userId)
		if (!member || !member.organizationIds.includes(group.organizationId)) throw new Error("User is not a member of the organization")
		if (!group.memberIds.includes(userId)) group.memberIds.push(userId)
		if (!member.groupIds.includes(group.id)) member.groupIds.push(group.id)
		await this.store.saveGroup(group)
		await this.store.saveUser(member)
		return group
	}

	async syncExternalGroups(user: User, organizationId: string, externalGroups: readonly string[]): Promise<User> {
		const groups = await this.store.listGroups(organizationId)
		const matches = groups.filter((group) => externalGroups.includes(group.name))
		for (const group of matches) {
			if (!group.memberIds.includes(user.id)) {
				group.memberIds.push(user.id)
				await this.store.saveGroup(group)
			}
		}
		const groupIds = new Set(user.groupIds)
		for (const group of matches) groupIds.add(group.id)
		const updated = { ...user, groupIds: [...groupIds] }
		await this.store.saveUser(updated)
		return updated
	}
}
