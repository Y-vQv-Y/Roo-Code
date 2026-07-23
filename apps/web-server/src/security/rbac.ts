import type { Permission, PermissionAction, PermissionResource, User, Role, UserGroup } from "../domain.js"

export class PermissionDeniedError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "PermissionDeniedError"
	}
}

export function permissionMatches(
	permission: Permission,
	organizationId: string,
	workspaceId: string | undefined,
	resource: PermissionResource,
	action: PermissionAction,
): boolean {
	return (
		permission.organizationId === organizationId &&
		(permission.workspaceId === undefined || permission.workspaceId === workspaceId) &&
		(permission.resource === "*" || permission.resource === resource) &&
		(permission.action === "*" || permission.action === action)
	)
}

export function hasPermission(
	user: User,
	roles: readonly Role[],
	groups: readonly UserGroup[],
	organizationId: string,
	workspaceId: string | undefined,
	resource: PermissionResource,
	action: PermissionAction,
): boolean {
	const roleIds = new Set(user.roleIds)
	for (const group of groups) {
		if (group.organizationId === organizationId && group.memberIds.includes(user.id)) {
			for (const roleId of group.roleIds) roleIds.add(roleId)
		}
	}
	return roles.some((role) => roleIds.has(role.id) && role.permissions.some((permission) => permissionMatches(permission, organizationId, workspaceId, resource, action)))
}

export function assertPermission(
	user: User,
	roles: readonly Role[],
	groups: readonly UserGroup[],
	organizationId: string,
	workspaceId: string | undefined,
	resource: PermissionResource,
	action: PermissionAction,
): void {
	if (!hasPermission(user, roles, groups, organizationId, workspaceId, resource, action)) {
		throw new PermissionDeniedError(`Permission denied: ${resource}:${action}`)
	}
}
